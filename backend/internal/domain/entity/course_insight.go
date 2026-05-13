package entity

// TagCount is a single insight tag with its occurrence count across a course's
// visible reviews.
type TagCount struct {
	Tag   string
	Count int
}

// InsightTagStat is a tag within a group with its raw count and percentage of
// that group's base (0–100, rounded to 1 decimal).
type InsightTagStat struct {
	Tag        string
	Count      int
	Percentage float64
}

// InsightGroupStat is one logical group of related tags with its base — the
// number of visible reviews that ticked at least one tag in this group.
// Percentages of tags inside the group are computed against Base, not against
// the course's total review count.
type InsightGroupStat struct {
	Key   string
	Title string
	Base  int
	Tags  []InsightTagStat
}

// CourseInsight is the aggregated insight summary for one course.
//
// MinReviewsForStats is the threshold below which percentages are suppressed —
// at that point the UI should render "X คนพูดถึง" rather than "X คน (Y%)".
type CourseInsight struct {
	TotalReviews       int
	MinReviewsForStats int
	Groups             []InsightGroupStat
	Badges             []string
	Warnings           []string
}
