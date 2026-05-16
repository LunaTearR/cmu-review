// Package ai is a thin, cost-aware layer that sits in FRONT of the
// embedding model and the existing intent JSON mapper.
//
// Two-stage pipeline:
//
//	Stage A  Intent Classification  (cheap, in-process, zero $$)
//	Stage B  Embedding Search        (paid, only when truly needed)
//
// Stage A combines:
//   - QueryPreprocessor   normalize text → cache hit ↑, tokens ↓
//   - IntentClassifier    rule-based routing (FILTER / KEYWORD / SEMANTIC / RECOMMEND)
//   - IntentRouter        glue + decision struct
//   - EmbeddingService    cached wrapper around port.EmbeddingGenerator
//
// Why a separate package: avoids the dependency hairball of importing the
// existing intent adapter from inside use cases. The use case keeps a
// stable port.IntentDetector dep; this package layers on top.
package ai

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// QueryPreprocessor normalizes raw user input into canonical search text.
// Running this BEFORE classification and BEFORE embed-cache lookup is the
// single biggest cost lever in the system:
//
//   - Same intent typed two ways resolves to ONE cache key, so duplicate
//     embed calls collapse to a single paid request.
//   - Removed noise (emojis, repeated punctuation, leading filler verbs
//     like "อยากได้", "ขอ", "หา") shrinks the token bill on the FIRST call.
//   - Lowercased Latin gives the rule classifier a stable surface to match.
//
// Pure / stateless / safe for concurrent use. No allocations on the hot
// path beyond the final string.
type QueryPreprocessor struct{}

func NewQueryPreprocessor() *QueryPreprocessor { return &QueryPreprocessor{} }

// Thai filler verbs / leading particles that carry no search signal. They
// inflate the input text without affecting meaning and they keep otherwise
// identical queries from sharing a cache key. Deliberately conservative —
// only strip when they appear as a PREFIX so "อยากเรียน X" → "เรียน X"
// stays intelligible; we don't try to be a Thai NLP toolkit here.
var thaiLeadingFillers = []string{
	"อยากได้", "อยากเรียน", "อยากหา", "อยาก",
	"ขอ", "ช่วย", "หา", "แนะนำ", "ช่วยแนะนำ",
	"มีไหม", "มีมั้ย",
}

// English filler prefixes for the same reason.
var enLeadingFillers = []string{
	"i want", "i need", "looking for", "find me", "find", "show me", "show", "please",
}

// stopwordsEN is intentionally tiny — only the tokens that produce no
// search value but inflate input. We do NOT strip Thai stopwords because
// Thai is unsegmented and naive removal corrupts meaning.
var stopwordsEN = map[string]struct{}{
	"a": {}, "an": {}, "the": {},
	"for": {}, "with": {}, "and": {}, "or": {},
	"me": {}, "my": {}, "any": {}, "some": {},
}

// Normalize is the single canonical text → text transform. Output is what
// flows into the classifier AND the embed cache key, so the function is
// deliberately deterministic.
func (p *QueryPreprocessor) Normalize(q string) string {
	if q == "" {
		return ""
	}
	// NFKC folds full-width / compatibility glyphs so "Ｈｅｌｌｏ" == "Hello".
	// Cheap; one allocation; equivalent inputs converge on one cache key.
	q = norm.NFKC.String(q)
	q = strings.ToLower(q)
	q = stripNoiseRunes(q)
	q = collapseWhitespace(q)
	q = stripLeading(q, thaiLeadingFillers)
	q = stripLeading(q, enLeadingFillers)
	q = strings.TrimSpace(q)
	return q
}

// Tokens splits the normalized query into searchable terms. Used by the
// KEYWORD path so we can hand the cheapest possible string to Postgres
// full-text / ILIKE. We strip English stopwords here (not in Normalize)
// so the embed cache key still reflects the user's actual phrasing —
// keyword extraction is for the SQL plan, not for cache identity.
func (p *QueryPreprocessor) Tokens(q string) []string {
	q = p.Normalize(q)
	if q == "" {
		return nil
	}
	raw := strings.FieldsFunc(q, func(r rune) bool {
		return unicode.IsSpace(r) || (unicode.IsPunct(r) && r != '-')
	})
	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, t := range raw {
		if t == "" {
			continue
		}
		if _, drop := stopwordsEN[t]; drop {
			continue
		}
		if _, dup := seen[t]; dup {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

// stripNoiseRunes drops emoji / pictographs / control runes. Keeps Thai,
// Latin, digits, hyphen, and basic separators. A naive runes-loop is fine:
// queries are short.
//
// IsMark MUST be kept alongside IsLetter: Thai vowels and tone marks
// (ั ิ ี ุ ู ่ ้ etc.) are Unicode `Mn` (Mark, Nonspacing) — not letters.
// Stripping them shreds every Thai word into unrecognizable pieces and
// breaks all downstream substring matching in the intent detector.
func stripNoiseRunes(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case unicode.IsLetter(r), unicode.IsMark(r), unicode.IsDigit(r), unicode.IsSpace(r):
			b.WriteRune(r)
		case r == '-', r == '_', r == '+', r == '.':
			b.WriteRune(r)
		default:
			b.WriteRune(' ')
		}
	}
	return b.String()
}

func collapseWhitespace(s string) string {
	var (
		b      strings.Builder
		prevSp = true
	)
	b.Grow(len(s))
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !prevSp {
				b.WriteByte(' ')
				prevSp = true
			}
			continue
		}
		b.WriteRune(r)
		prevSp = false
	}
	return b.String()
}

func stripLeading(s string, prefixes []string) string {
	t := strings.TrimSpace(s)
	for _, p := range prefixes {
		if p == "" {
			continue
		}
		if strings.HasPrefix(t, p) {
			rest := strings.TrimSpace(t[len(p):])
			if rest != "" {
				return rest
			}
		}
	}
	return t
}
