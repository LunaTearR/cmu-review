package ai

import (
	"cmu-review-backend/internal/usecase/port"
)

// Decision is what IntentRouter.Route hands back to the caller. It bundles
// the classification verdict with the artifacts every retrieval lane will
// need so the use case doesn't re-derive them.
//
// The use case branches on Kind:
//
//	IntentFilter         → SQL only        (NeedsEmbedding=false)
//	IntentKeyword        → SQL full-text   (NeedsEmbedding=false)
//	IntentSemantic       → vector search   (NeedsEmbedding=true)
//	IntentRecommendation → vector search   (NeedsEmbedding=true)
//
// CleanQuery is what should be fed to BOTH the SQL search column AND the
// embed-cache key, so cache hits survive cosmetic input variations.
type Decision struct {
	Kind           IntentKind
	Confidence     float64
	Reason         string
	CleanQuery     string
	Keywords       []string
	Filter         port.IntentFilter
	NeedsEmbedding bool
}

// IntentRouter is the public face of Stage A. One call gives the caller
// everything it needs to skip the embed model when possible.
//
// Why a router and not just "call classifier directly":
//   - Centralizes the preprocess + classify + filter-extract sequence so
//     every caller goes through the same path (one cache key shape, one
//     decision shape).
//   - Lets us swap rules → small LLM in one place if needed later, without
//     touching call sites.
type IntentRouter struct {
	pre      *QueryPreprocessor
	clf      *IntentClassifier
	detector port.IntentDetector
}

func NewIntentRouter(
	pre *QueryPreprocessor,
	clf *IntentClassifier,
	detector port.IntentDetector,
) *IntentRouter {
	return &IntentRouter{pre: pre, clf: clf, detector: detector}
}

// Route is the single decision point. Pure / no I/O / safe to call on the
// hot path. The returned Decision can be cached if the caller ever wants
// to memoize routing per-query — currently not done because the work is
// already submillisecond.
func (r *IntentRouter) Route(rawQuery string) Decision {
	clean := r.pre.Normalize(rawQuery)
	tokens := r.pre.Tokens(rawQuery)
	classification := r.clf.Classify(clean)

	var filter port.IntentFilter
	if r.detector != nil {
		filter = r.detector.Detect(clean)
	}

	needsEmbed := classification.Kind == IntentSemantic ||
		classification.Kind == IntentRecommendation

	return Decision{
		Kind:           classification.Kind,
		Confidence:     classification.Confidence,
		Reason:         classification.Reason,
		CleanQuery:     clean,
		Keywords:       tokens,
		Filter:         filter,
		NeedsEmbedding: needsEmbed,
	}
}
