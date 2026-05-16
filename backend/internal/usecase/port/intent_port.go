package port

// IntentFilter is the strict-filter slice an intent detector extracts from
// a natural-language query. Members are unioned with caller-supplied
// filters before search runs. When multiple members are non-empty they
// AND together at the repository layer.
type IntentFilter struct {
	// Tags overlap reviews.insight_tags (text[] && operator).
	Tags []string
	// Categories match reviews.category exactly (one of).
	Categories []string
	// Programs match reviews.program exactly (one of).
	Programs []string
}

// IntentDetector turns a free-form user query into structured DB filters.
// Implementations are config-driven so the embedding/search use case has
// no hardcoded vocabulary — see internal/adapter/intent.JSONMapper.
//
// Detect MUST be safe to call concurrently and MUST NOT panic on an
// unknown or empty query (return zero IntentFilter instead).
type IntentDetector interface {
	Detect(query string) IntentFilter
}
