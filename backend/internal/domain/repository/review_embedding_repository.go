package repository

import "context"

// ReviewMatch is a single hit from semantic search: the review row plus its
// course id and similarity score (higher = more similar).
type ReviewMatch struct {
	ReviewID   int64
	CourseID   int
	Content    string
	Similarity float64
}

// ReviewEmbedSource is the bundle of fields used to compose the text that
// gets embedded for a single review. Returned by ListMissingEmbedSources so
// the backfill CLI can build the exact same text as the live AutoEmbed path
// (see usecase/review.ComposeReviewEmbedText). Keeping it here — not in
// usecase — preserves the dependency direction (adapter → domain repo).
type ReviewEmbedSource struct {
	ID           int64
	CourseID     int
	Content      string
	Tags         []string
	CourseNameTH string
	CourseNameEN string
}

// ReviewEmbeddingRepository handles vector-side operations on reviews.
// Kept separate from ReviewRepository so existing code is untouched.
type ReviewEmbeddingRepository interface {
	UpdateEmbedding(ctx context.Context, reviewID int64, vec []float32) error
	// SearchSimilar returns the top-N visible reviews most similar to `vec`.
	// If requiredTags is non-empty, only reviews whose insight_tags overlap
	// at least one of the given tags are considered.
	// If requiredCategories is non-empty, only reviews whose `category` is
	// one of the given values are considered. Both filters AND together.
	SearchSimilar(ctx context.Context, vec []float32, limit int, requiredTags []string, requiredCategories []string) ([]ReviewMatch, error)
	// ListMissingEmbedding is the legacy thin lister (content only). Kept
	// for back-compat; new callers should prefer ListMissingEmbedSources so
	// embedding text includes course name + tags.
	ListMissingEmbedding(ctx context.Context, limit int) ([]ReviewContent, error)
	// ListMissingEmbedSources returns full embed-source bundles (joined to
	// courses) for reviews whose `embedding` column is still NULL.
	ListMissingEmbedSources(ctx context.Context, limit int) ([]ReviewEmbedSource, error)
	// ListMissingEmbedSourcesByCourse is the per-course variant used by the
	// embedding worker after it claims a courseID from the queue. Only
	// reviews of the given course with NULL embedding are returned.
	ListMissingEmbedSourcesByCourse(ctx context.Context, courseID, limit int) ([]ReviewEmbedSource, error)
}
