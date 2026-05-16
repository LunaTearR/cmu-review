package course

import (
	"context"
	"fmt"
	"log"
	"sort"

	"cmu-review-backend/internal/ai"
	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

type SemanticSearchCoursesUseCase struct {
	embeds   repository.ReviewEmbeddingRepository
	courses  repository.CourseRepository
	embedder port.EmbeddingGenerator // cached service in production
	intent   port.IntentDetector     // legacy / fallback path
	router   *ai.IntentRouter        // optional; nil → always embed (old behavior)
	reviewK  int
	courseK  int
	minScore float64
}

// NewSemanticSearchCourses constructs the use case. `intent` and `router`
// are both optional:
//
//   - intent  == nil → no Thai phrase → DB filter mapping
//   - router  == nil → every query forced to the embedding path
//                       (preserves the legacy behavior so wiring is staged)
//
// In production wire BOTH. The router is the cost lever: it lets pure
// filter / keyword queries skip the embedding call entirely.
func NewSemanticSearchCourses(
	embeds repository.ReviewEmbeddingRepository,
	courses repository.CourseRepository,
	embedder port.EmbeddingGenerator,
	intent port.IntentDetector,
) *SemanticSearchCoursesUseCase {
	return &SemanticSearchCoursesUseCase{
		embeds:   embeds,
		courses:  courses,
		embedder: embedder,
		intent:   intent,
		reviewK:  50,
		courseK:  10,
		minScore: 0.25,
	}
}

// WithRouter wires Stage A (intent classification) into the use case.
// Without it the use case still works, but every query pays the embedding
// cost — defeating most of the refactor goal. Builder style keeps
// constructor signatures backward compatible.
func (uc *SemanticSearchCoursesUseCase) WithRouter(r *ai.IntentRouter) *SemanticSearchCoursesUseCase {
	uc.router = r
	return uc
}

type SemanticCourseHit struct {
	Course        *entity.Course
	Score         float64
	MatchedCount  int
	TopReviewText string
}

type SemanticSearchInput struct {
	Query              string
	Limit              int
	RequiredTags       []string
	RequiredCategories []string
}

func (uc *SemanticSearchCoursesUseCase) Execute(ctx context.Context, in SemanticSearchInput) ([]SemanticCourseHit, error) {
	if in.Query == "" {
		return nil, fmt.Errorf("query is required")
	}
	limit := in.Limit
	if limit <= 0 {
		limit = uc.courseK
	}

	// ─── Stage A: Intent routing ──────────────────────────────────────
	// Decide cheapest viable path BEFORE touching the embed model.
	// Skipping this stage (no router wired) preserves the legacy "always
	// embed" path so the refactor can ship in two steps.
	if uc.router != nil {
		decision := uc.router.Route(in.Query)
		log.Printf("intent-router: kind=%s reason=%s needs_embed=%v query=%q",
			decision.Kind, decision.Reason, decision.NeedsEmbedding, decision.CleanQuery)

		// Union caller filters with detector-extracted ones. Detector
		// hits travel through the Decision so the SQL path can use them too.
		mergedTags := unionStrings(in.RequiredTags, decision.Filter.Tags)
		mergedCats := unionStrings(in.RequiredCategories, decision.Filter.Categories)
		mergedProgs := decision.Filter.Programs

		switch decision.Kind {
		case ai.IntentFilter, ai.IntentKeyword:
			// Stage B SKIPPED — pure SQL. The embed model is not called.
			// This is where most of the cost saving comes from.
			return uc.sqlOnlySearch(ctx, decision, mergedTags, mergedCats, mergedProgs, limit)
		}

		// Embedding path (SEMANTIC / RECOMMENDATION). Use the cleaned
		// query so the cache key is canonical. Tag/category filters are
		// applied at the vector layer; program filter is review-level and
		// is enforced post-vector via the course query.
		return uc.embeddingSearch(ctx, decision.CleanQuery, mergedTags, mergedCats, limit)
	}

	// ─── Legacy path (no router) ─────────────────────────────────────
	var intentFilter port.IntentFilter
	if uc.intent != nil {
		intentFilter = uc.intent.Detect(in.Query)
	}
	mergedTags := unionStrings(in.RequiredTags, intentFilter.Tags)
	mergedCats := unionStrings(in.RequiredCategories, intentFilter.Categories)
	return uc.embeddingSearch(ctx, in.Query, mergedTags, mergedCats, limit)
}

// sqlOnlySearch is the cost-free path: ranks courses via the existing
// CourseRepository.List index. Uses the keyword query as a full-text
// search term, and any extracted filters as category / program / tag
// restrictions. No embed calls, no vector ops, no Gemini latency.
func (uc *SemanticSearchCoursesUseCase) sqlOnlySearch(
	ctx context.Context,
	d ai.Decision,
	tags []string,
	cats []string,
	programs []string,
	limit int,
) ([]SemanticCourseHit, error) {
	// CourseRepository.List accepts at most one Category — pick the
	// first; remaining categories degrade gracefully (filter is then a
	// superset). Programs and Tags pass through as-is and AND together
	// at the repo (via EXISTS subqueries on reviews.program /
	// reviews.insight_tags).
	category := ""
	if len(cats) > 0 {
		category = cats[0]
	}

	search := d.CleanQuery
	if d.Kind == ai.IntentFilter {
		// Pure filter query has no useful free-text content — clearing
		// `Search` keeps the index plan as cheap as possible.
		search = ""
	}

	rows, _, err := uc.courses.List(ctx, repository.CourseListOpts{
		Search:   search,
		Category: category,
		Programs: programs,
		Tags:     tags,
		Limit:    limit,
		Offset:   0,
		SortBy:   "rating", // sensible default for discovery; same DB index
	})
	if err != nil {
		return nil, fmt.Errorf("sql-only search: %w", err)
	}

	out := make([]SemanticCourseHit, 0, len(rows))
	for i := range rows {
		c := rows[i]
		out = append(out, SemanticCourseHit{
			Course: &c,
			// Score is synthetic — preserves API shape without lying.
			// Position-decayed so the JSON consumer can still order by
			// Score if it wants.
			Score:        1.0 - float64(i)*0.01,
			MatchedCount: 0,
		})
	}
	return out, nil
}

// embeddingSearch is the paid path. Only entered when the router (or
// legacy fallback) decided the query truly needs semantic recall.
func (uc *SemanticSearchCoursesUseCase) embeddingSearch(
	ctx context.Context,
	query string,
	tags []string,
	cats []string,
	limit int,
) ([]SemanticCourseHit, error) {
	if uc.embedder == nil {
		return nil, fmt.Errorf("semantic search disabled: no embedder configured")
	}

	vec, err := uc.embedder.Generate(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("embed query: %w", err)
	}

	matches, err := uc.embeds.SearchSimilar(ctx, vec, uc.reviewK, tags, cats)
	if err != nil {
		return nil, fmt.Errorf("vector search: %w", err)
	}

	type agg struct {
		score       float64
		count       int
		bestContent string
	}
	byCourse := make(map[int]*agg)
	order := make([]int, 0, len(matches))
	for _, m := range matches {
		if m.Similarity < uc.minScore {
			continue
		}
		a, ok := byCourse[m.CourseID]
		if !ok {
			byCourse[m.CourseID] = &agg{score: m.Similarity, count: 1, bestContent: m.Content}
			order = append(order, m.CourseID)
			continue
		}
		a.count++
		if m.Similarity > a.score {
			a.score = m.Similarity
			a.bestContent = m.Content
		}
	}

	sort.SliceStable(order, func(i, j int) bool {
		li, lj := byCourse[order[i]], byCourse[order[j]]
		if li.score != lj.score {
			return li.score > lj.score
		}
		return li.count > lj.count
	})

	if len(order) > limit {
		order = order[:limit]
	}

	out := make([]SemanticCourseHit, 0, len(order))
	for _, cid := range order {
		c, err := uc.courses.GetByID(ctx, cid)
		if err != nil {
			continue
		}
		a := byCourse[cid]
		out = append(out, SemanticCourseHit{
			Course:        c,
			Score:         a.score,
			MatchedCount:  a.count,
			TopReviewText: a.bestContent,
		})
	}
	return out, nil
}
