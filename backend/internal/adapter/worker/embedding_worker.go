// Package worker hosts background goroutines that operate on the database
// outside the HTTP request path. Each worker is started from cmd/main.go
// after all repositories are constructed and is given an explicit Stop
// method so the process can shut down cleanly without leaking goroutines.
package worker

import (
	"context"
	"log"
	"sync"
	"time"

	"cmu-review-backend/internal/domain/repository"
)

// Rebuilder is the contract EmbeddingWorker needs from the per-course
// embedding rebuild use case. Kept as a tiny local interface so the worker
// has no dependency on usecase/course at type level — only behavior.
type Rebuilder interface {
	Execute(ctx context.Context, courseID int) error
}

// EmbeddingWorker drains the per-course embedding_queue table on a fixed
// interval. Concurrency model:
//
//   - One long-lived goroutine started by Start(). No per-tick spawning.
//   - Each tick: claim up to BatchSize courses (atomic SQL via the queue
//     repository), then rebuild them sequentially within a tick-scoped ctx.
//   - Stop(ctx) closes a done channel and waits for the goroutine to exit;
//     idempotent via sync.Once so double-Stop is safe.
//
// Why no race: ClaimBatch is a single SQL stmt using FOR UPDATE SKIP LOCKED
// — two workers (e.g. two pods) cannot receive the same courseID.
// Why no deadlock: no Go mutex held across IO; each DB call is a short tx;
// SKIP LOCKED never waits, it skips.
// Why no livelock: failures log + continue, no inner retry loop; bounded
// action rate = 1 / Interval regardless of error rate.
// Why no goroutine leak: exactly one named goroutine; Stop joins it.
type EmbeddingWorker struct {
	queue     repository.EmbeddingQueueRepository
	rebuild   Rebuilder
	interval  time.Duration
	batchSize int
	perJobTO  time.Duration

	stopOnce sync.Once
	stopCh   chan struct{}
	doneCh   chan struct{}
}

type Config struct {
	// Interval is the tick period. Default 20s per spec — the debounce
	// window for a burst of reviews to coalesce in the queue.
	Interval time.Duration
	// BatchSize is the maximum number of courses claimed per tick. Default 50.
	BatchSize int
	// PerJobTimeout caps a single course's rebuild. Default 60s. Set
	// generously: rebuilding a course with N missing reviews may make N
	// Gemini calls.
	PerJobTimeout time.Duration
}

func NewEmbeddingWorker(queue repository.EmbeddingQueueRepository, rebuild Rebuilder, cfg Config) *EmbeddingWorker {
	if cfg.Interval <= 0 {
		cfg.Interval = 20 * time.Second
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 50
	}
	if cfg.PerJobTimeout <= 0 {
		cfg.PerJobTimeout = 60 * time.Second
	}
	return &EmbeddingWorker{
		queue:     queue,
		rebuild:   rebuild,
		interval:  cfg.Interval,
		batchSize: cfg.BatchSize,
		perJobTO:  cfg.PerJobTimeout,
		stopCh:    make(chan struct{}),
		doneCh:    make(chan struct{}),
	}
}

// Start launches the single worker goroutine. Non-blocking. Call once.
// Calling Start twice is a programmer error — there is no guard because
// it would silently mask the bug; main.go owns lifecycle.
func (w *EmbeddingWorker) Start() {
	go w.run()
}

// Stop signals shutdown and waits for the goroutine to exit, or until the
// supplied context is canceled (whichever comes first). Idempotent.
// Returns ctx.Err() if the shutdown deadline expires before the worker
// finishes its current job.
func (w *EmbeddingWorker) Stop(ctx context.Context) error {
	w.stopOnce.Do(func() { close(w.stopCh) })
	select {
	case <-w.doneCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (w *EmbeddingWorker) run() {
	defer close(w.doneCh)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Printf("embedding_worker: started (interval=%s, batch=%d)", w.interval, w.batchSize)

	// Drain immediately on boot so a queue left from the previous process
	// does not wait the full tick before being processed.
	w.processOnce()

	for {
		select {
		case <-w.stopCh:
			log.Println("embedding_worker: stop signal received; exiting")
			return
		case <-ticker.C:
			w.processOnce()
		}
	}
}

// processOnce executes one full tick: claim a batch and rebuild each
// course sequentially. Panics are recovered so a bad row does not kill
// the worker goroutine (which would otherwise stop processing future
// ticks until process restart — a silent feature outage).
func (w *EmbeddingWorker) processOnce() {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("embedding_worker: panic recovered: %v", rec)
		}
	}()

	// Tick-scoped context. The 2*Interval bound prevents a stuck DB call
	// from pinning the worker forever; if a tick legitimately needs more
	// time the operator should raise PerJobTimeout, not this bound.
	ctx, cancel := context.WithTimeout(context.Background(), 2*w.interval)
	defer cancel()

	ids, err := w.queue.ClaimBatch(ctx, w.batchSize)
	if err != nil {
		log.Printf("embedding_worker: claim: %v", err)
		return
	}
	if len(ids) == 0 {
		return
	}
	log.Printf("embedding_worker: claimed %d courses", len(ids))

	for i, courseID := range ids {
		// Check stop signal between jobs so a long backlog does not
		// hold up process shutdown. The remaining IDs in this batch
		// were already removed from the queue — they will be picked up
		// by the next enqueue for that course or by the backfill CLI.
		select {
		case <-w.stopCh:
			log.Printf("embedding_worker: stop mid-batch; dropped %d remaining courses", len(ids)-i)
			return
		default:
		}

		jobCtx, jobCancel := context.WithTimeout(ctx, w.perJobTO)
		if err := w.rebuild.Execute(jobCtx, courseID); err != nil {
			log.Printf("embedding_worker: rebuild course %d: %v", courseID, err)
		}
		jobCancel()
	}
}
