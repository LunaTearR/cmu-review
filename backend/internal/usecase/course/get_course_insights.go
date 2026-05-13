package course

import (
	"context"
	"math"

	"cmu-review-backend/internal/domain/entity"
	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
)

// Confidence thresholds — kept as constants so they are easy to tune.
const (
	// MinTotalForInsights — below this the insight section is suppressed entirely.
	MinTotalForInsights = 3
	// MinTotalForPercentage — at or above this the UI may display percentages
	// alongside counts. Below it, only counts ("X คนพูดถึง") should be shown.
	MinTotalForPercentage = 5
	// MinGroupBaseForRules — minimum group base before a derived badge / warning
	// rule may fire. Stops 2/2 → 100% from looking like consensus.
	MinGroupBaseForRules = 3
)

// insightGroup is the server-side mirror of the frontend GROUPS table.
// The list of tags MUST stay in sync with frontend/src/components/InsightCheckboxes.tsx
// or per-group bases will be undercounted.
type insightGroup struct {
	Key   string
	Title string
	Tags  []string
}

var insightGroups = []insightGroup{
	{
		Key:   "attendance",
		Title: "การเข้าเรียน / เช็คชื่อ",
		Tags: []string{
			"ไม่เช็คชื่อ",
			"เช็คชื่อเกือบทุกคาบ",
			"ไม่บังคับเข้าเรียน",
			"มีเรียนออนไลน์",
			"ไม่มีคลาสเรียน",
		},
	},
	{
		Key:   "workload",
		Title: "ภาระงานระหว่างเทอม",
		Tags: []string{
			"งานน้อย ทำสบาย",
			"งานสม่ำเสมอตลอดเทอม",
			"งานค่อนข้างเยอะ",
			"มีโปรเจกต์ใหญ่ปลายเทอม",
			"มีแล็บ / ปฏิบัติการ",
			"งานกลุ่มเป็นหลัก",
			"งานเดี่ยวเป็นหลัก",
		},
	},
	{
		Key:   "grading",
		Title: "การวัดผล / การให้คะแนน",
		Tags: []string{
			"เน้นสอบเป็นหลัก",
			"ข้อสอบอิงสไลด์ / ที่สอน",
			"เก็บคะแนนจากงานเป็นหลัก",
			"ส่งงานครบคะแนนไม่ยาก",
			"ข้อสอบยาก ต้องอ่านเพิ่ม",
		},
	},
	{
		Key:   "teaching",
		Title: "ลักษณะการสอน",
		Tags: []string{
			"สอนเข้าใจง่าย",
			"สอนละเอียดเป็นขั้นตอน",
			"สอนไว ต้องตามเอง",
			"สอนตามสไลด์",
			"เน้นเล่าประสบการณ์ / เคสจริง",
			"ต้องอ่านและศึกษาด้วยตัวเองเยอะ",
		},
	},
	{
		Key:   "audience",
		Title: "เหมาะกับนักศึกษาแบบไหน",
		Tags: []string{
			"เหมาะกับคนไม่ชอบเข้าเรียน",
			"เหมาะกับคนอยากเก็บเกรด",
			"เหมาะกับคนขยันทำงานสม่ำเสมอ",
			"เหมาะกับคนชอบทำงานกลุ่ม",
			"ควรมีพื้นฐานมาก่อน",
			"เหมาะกับคนอยากนำความรู้ไปใช้จริง",
		},
	},
}

// tagStat — internal record used while evaluating derived rules.
type tagStat struct {
	Count     int
	GroupBase int
	Pct       float64
}

// GetCourseInsightsUseCase computes group-scoped tag statistics for one course.
//
// Each group's denominator is the count of visible reviews that ticked at
// least one tag in that group — NOT the course's total review count. This
// prevents reviews that skip the checkbox section from being misread as
// negative signal.
type GetCourseInsightsUseCase struct {
	reviews repository.ReviewRepository
	courses repository.CourseRepository
}

func NewGetCourseInsights(
	reviews repository.ReviewRepository,
	courses repository.CourseRepository,
) *GetCourseInsightsUseCase {
	return &GetCourseInsightsUseCase{reviews: reviews, courses: courses}
}

func (uc *GetCourseInsightsUseCase) Execute(ctx context.Context, courseID int) (*entity.CourseInsight, error) {
	ok, err := uc.courses.Exists(ctx, courseID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domainerrors.ErrCourseNotFound
	}

	total, err := uc.reviews.CountVisibleByCourse(ctx, courseID)
	if err != nil {
		return nil, err
	}

	out := &entity.CourseInsight{
		TotalReviews:       total,
		MinReviewsForStats: MinTotalForPercentage,
		Groups:             []entity.InsightGroupStat{},
		Badges:             []string{},
		Warnings:           []string{},
	}

	// Below the floor, return empty groups so the UI hides the section.
	if total < MinTotalForInsights {
		return out, nil
	}

	tagCounts, err := uc.reviews.AggregateInsightTags(ctx, courseID)
	if err != nil {
		return nil, err
	}
	countByTag := make(map[string]int, len(tagCounts))
	for _, tc := range tagCounts {
		countByTag[tc.Tag] = tc.Count
	}

	stats := make(map[string]tagStat) // tag → stats for rule eval

	for _, g := range insightGroups {
		base, err := uc.reviews.CountByTagOverlap(ctx, courseID, g.Tags)
		if err != nil {
			return nil, err
		}
		if base == 0 {
			continue // skip groups nobody touched
		}

		groupTags := make([]entity.InsightTagStat, 0, len(g.Tags))
		for _, tag := range g.Tags {
			c := countByTag[tag]
			if c == 0 {
				continue
			}
			pct := float64(c) / float64(base) * 100
			groupTags = append(groupTags, entity.InsightTagStat{
				Tag:        tag,
				Count:      c,
				Percentage: roundTo(pct, 1),
			})
			stats[tag] = tagStat{Count: c, GroupBase: base, Pct: pct}
		}
		if len(groupTags) == 0 {
			continue
		}

		// Sort descending by count so the panel renders the strongest signals first.
		sortTagsByCount(groupTags)

		out.Groups = append(out.Groups, entity.InsightGroupStat{
			Key:   g.Key,
			Title: g.Title,
			Base:  base,
			Tags:  groupTags,
		})
	}

	// Derived badges / warnings are only trustworthy with enough data — both at
	// course level and within the rule's own group.
	if total >= MinTotalForPercentage {
		applyInsightRules(stats, out)
	}

	return out, nil
}

func sortTagsByCount(tags []entity.InsightTagStat) {
	for i := 1; i < len(tags); i++ {
		for j := i; j > 0; j-- {
			a, b := tags[j-1], tags[j]
			if b.Count > a.Count || (b.Count == a.Count && b.Tag < a.Tag) {
				tags[j-1], tags[j] = b, a
				continue
			}
			break
		}
	}
}

// insightRule describes one derived badge / warning. Cond receives a tag→stats
// map; the rule may inspect group base + percentage of any tag it cares about.
type insightRule struct {
	Kind    string // "badge" | "warning"
	Message string
	Cond    func(s map[string]tagStat) bool
}

// strongTag returns true when a tag's group has enough data AND the tag passes
// the given percentage threshold within its group.
func strongTag(s map[string]tagStat, tag string, minPct float64) bool {
	st, ok := s[tag]
	if !ok {
		return false
	}
	return st.GroupBase >= MinGroupBaseForRules && st.Pct > minPct
}

var insightRules = []insightRule{
	{
		Kind: "badge", Message: "งานไม่หนัก",
		Cond: func(s map[string]tagStat) bool { return strongTag(s, "งานน้อย ทำสบาย", 60) },
	},
	{
		Kind: "badge", Message: "ไม่เช็คชื่อ",
		Cond: func(s map[string]tagStat) bool { return strongTag(s, "ไม่เช็คชื่อ", 60) },
	},
	{
		Kind: "warning", Message: "ข้อสอบค่อนข้างยาก",
		Cond: func(s map[string]tagStat) bool { return strongTag(s, "ข้อสอบยาก ต้องอ่านเพิ่ม", 50) },
	},
	{
		Kind: "warning", Message: "ภาระงานและสอบหนัก",
		Cond: func(s map[string]tagStat) bool {
			return strongTag(s, "งานค่อนข้างเยอะ", 40) && strongTag(s, "ข้อสอบยาก ต้องอ่านเพิ่ม", 40)
		},
	},
}

func applyInsightRules(stats map[string]tagStat, out *entity.CourseInsight) {
	for _, rule := range insightRules {
		if !rule.Cond(stats) {
			continue
		}
		switch rule.Kind {
		case "badge":
			out.Badges = append(out.Badges, rule.Message)
		case "warning":
			out.Warnings = append(out.Warnings, rule.Message)
		}
	}
}

func roundTo(v float64, decimals int) float64 {
	shift := math.Pow(10, float64(decimals))
	return math.Round(v*shift) / shift
}
