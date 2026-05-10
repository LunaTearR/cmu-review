package search

import (
	"strings"
	"unicode"
)

const MaxSearchLen = 100

// Sanitize cleans raw user search input for safe use in database queries.
// It removes control characters, collapses whitespace, and enforces a length cap.
// Returns empty string when the result is blank (caller treats as "no search").
func Sanitize(raw string) string {
	// Strip C0/C1 control characters (\x00–\x1F, \x7F–\x9F).
	// These have no meaning in search and can be used to confuse tokenizers.
	s := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, raw)

	// Collapse internal whitespace to single spaces, trim edges.
	s = strings.Join(strings.Fields(s), " ")

	// Enforce max rune length (not byte length) so a string of 4-byte Thai
	// characters doesn't get sliced mid-codepoint.
	if runes := []rune(s); len(runes) > MaxSearchLen {
		s = string(runes[:MaxSearchLen])
	}

	return s
}
