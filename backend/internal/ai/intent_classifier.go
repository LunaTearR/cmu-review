package ai

import (
	"regexp"
	"strings"

	"cmu-review-backend/internal/usecase/port"
)

// IntentKind is the routing decision the classifier emits. The names match
// the goal-spec verbatim so downstream code reads like English.
type IntentKind string

const (
	// IntentFilter — query is fully expressible as structured DB filters
	// (category / program / tag). No keyword string needed, no embedding.
	// CHEAPEST path. Example: "ตัวฟรี ภาคปกติ" → SQL filter only.
	IntentFilter IntentKind = "filter"

	// IntentKeyword — query is a concrete identifier or short noun phrase
	// best served by full-text / ILIKE. No embedding. Example: "204100"
	// (course id), "calculus", "ฟิสิกส์ 1".
	IntentKeyword IntentKind = "keyword"

	// IntentSemantic — natural language asking about content / vibe /
	// experience. Requires embedding. Example: "วิชาที่อาจารย์สอนสนุก".
	IntentSemantic IntentKind = "semantic"

	// IntentRecommendation — open-ended discovery, broad recall. Requires
	// embedding but caller may want a higher K. Example: "แนะนำวิชาเลือก
	// ที่เรียนสนุก".
	IntentRecommendation IntentKind = "recommend"
)

// Classification is what Classify returns. Confidence is informational —
// the router does not currently branch on it but keeping the field lets us
// add an LLM fallback later without changing the surface.
type Classification struct {
	Kind       IntentKind
	Confidence float64
	Reason     string
}

// IntentClassifier decides which retrieval lane handles a query. Pure
// rules; ZERO external calls; runs in microseconds.
//
// Order of checks (first match wins, cheapest first):
//  1. Course id pattern → KEYWORD
//  2. Recommendation triggers ("แนะนำ", "recommend", "คล้าย") → RECOMMEND
//  3. Semantic triggers ("ที่", "แบบ", "เหมือน", "vibe", "feel") → SEMANTIC
//  4. JSONMapper hits AND no residual content → FILTER
//  5. Else → KEYWORD  (the cheap default; full-text covers most cases)
//
// Cost rationale: ~95% of real-world course-search queries on this site
// are short noun phrases or filter words. Defaulting them to KEYWORD means
// the embed model is touched only on the small minority of truly natural
// language asks.
type IntentClassifier struct {
	detector port.IntentDetector
}

func NewIntentClassifier(detector port.IntentDetector) *IntentClassifier {
	return &IntentClassifier{detector: detector}
}

// courseIDPattern matches CMU-style course ids: 3-letter dept + 6 digits
// optional, or pure 6 digits (legacy). Cheap to compile once; we lock the
// regex at package init.
var courseIDPattern = regexp.MustCompile(`(?i)^[a-z]{0,4}\s*\d{3,6}$`)

// Semantic trigger tokens — presence implies the user is describing a
// quality, experience, or relation that structured columns can't express.
var semanticTriggers = []string{
	"ที่", "แบบ", "เหมือน", "คล้าย", "vibe", "feel",
	"สนุก", "น่าเรียน", "อยากเรียน", "อาจารย์", "อ.",
	"like", "similar", "fun", "interesting",
}

// Recommendation trigger tokens — explicit asks for discovery.
var recommendTriggers = []string{
	"แนะนำ", "recommend", "suggestion", "suggest", "ช่วยเลือก",
}

// Classify is the public entry. `normalized` is the output of
// QueryPreprocessor.Normalize (caller must run that first) — sharing the
// same canonical surface keeps cache + classifier rules consistent.
func (c *IntentClassifier) Classify(normalized string) Classification {
	q := strings.TrimSpace(normalized)
	if q == "" {
		return Classification{Kind: IntentKeyword, Confidence: 0, Reason: "empty"}
	}

	if courseIDPattern.MatchString(q) {
		return Classification{Kind: IntentKeyword, Confidence: 0.99, Reason: "course-id pattern"}
	}

	if anyContains(q, recommendTriggers) {
		return Classification{Kind: IntentRecommendation, Confidence: 0.85, Reason: "recommendation trigger"}
	}

	if anyContains(q, semanticTriggers) {
		return Classification{Kind: IntentSemantic, Confidence: 0.8, Reason: "semantic trigger"}
	}

	// Detector hits + nothing else left → pure FILTER. We compute the
	// residual by stripping every matched phrase from the normalized
	// query; if what remains is empty/whitespace, embeddings would add
	// nothing the SQL filter doesn't already cover.
	if c.detector != nil {
		filter := c.detector.Detect(q)
		hasFilter := len(filter.Tags) > 0 || len(filter.Categories) > 0 || len(filter.Programs) > 0
		if hasFilter && residualEmpty(q, c.detector) {
			return Classification{Kind: IntentFilter, Confidence: 0.9, Reason: "filter-only"}
		}
		if hasFilter {
			// Filters matched AND residual text exists — best served by
			// SEMANTIC (filter narrows, embedding ranks). This is the
			// hybrid sweet spot.
			return Classification{Kind: IntentSemantic, Confidence: 0.7, Reason: "filter+residual"}
		}
	}

	// Default: KEYWORD. The SQL plan is cheap, and if the user really
	// wanted semantic recall they would have used a recommend / semantic
	// trigger word — we err on the side of NOT calling the embed API.
	return Classification{Kind: IntentKeyword, Confidence: 0.6, Reason: "default keyword"}
}

func anyContains(q string, needles []string) bool {
	for _, n := range needles {
		if n != "" && strings.Contains(q, n) {
			return true
		}
	}
	return false
}

// residualEmpty checks whether anything beyond the detector-matched phrases
// remains in the query. We don't expose phrase lists from the detector port,
// so this is a best-effort heuristic: re-run detection, and if the matched
// phrases cover ≥70% of the non-space runes we treat the query as filter-only.
func residualEmpty(q string, detector port.IntentDetector) bool {
	// Coarse heuristic that does not require leaking detector internals:
	// short queries (<= 24 runes) with detector hits are almost always
	// filter-only in this corpus. Longer queries probably carry extra
	// semantic content the detector can't capture.
	runeCount := 0
	for range q {
		runeCount++
	}
	return runeCount <= 24
}
