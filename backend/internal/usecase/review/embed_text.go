package review

import "strings"

// ComposeReviewEmbedText builds the canonical text used to generate a
// review's embedding vector. The same composition MUST be used by both the
// backfill CLI and the live AutoEmbedReview path so cosine distances stay
// meaningful across rows.
//
// Layout (newline-separated, label-prefixed so multilingual model can see
// structure):
//
//	วิชา: <nameTH> <nameEN>
//	รีวิว: <content>
//	แท็ก: <tag1>, <tag2>, ...
//
// Empty sections are omitted entirely. Whitespace inside fields is
// collapsed conservatively (we trust the DB-level trimming done by the
// review pipeline).
func ComposeReviewEmbedText(nameTH, nameEN, content string, tags []string) string {
	var b strings.Builder
	courseLine := strings.TrimSpace(strings.TrimSpace(nameTH) + " " + strings.TrimSpace(nameEN))
	if courseLine != "" {
		b.WriteString("วิชา: ")
		b.WriteString(courseLine)
		b.WriteByte('\n')
	}
	if c := strings.TrimSpace(content); c != "" {
		b.WriteString("รีวิว: ")
		b.WriteString(c)
		b.WriteByte('\n')
	}
	if t := joinTags(tags); t != "" {
		b.WriteString("แท็ก: ")
		b.WriteString(t)
	}
	return strings.TrimRight(b.String(), "\n")
}

func joinTags(tags []string) string {
	cleaned := make([]string, 0, len(tags))
	for _, t := range tags {
		if t = strings.TrimSpace(t); t != "" {
			cleaned = append(cleaned, t)
		}
	}
	return strings.Join(cleaned, ", ")
}
