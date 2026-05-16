package course

import "strings"

// unionStrings merges two string slices, trimming + deduping. Order is
// preserved from the first slice, then any new entries from the second.
// Used by SemanticSearchCoursesUseCase to combine explicit filter params
// with values returned by the injected port.IntentDetector.
func unionStrings(a, b []string) []string {
	seen := make(map[string]struct{}, len(a)+len(b))
	out := make([]string, 0, len(a)+len(b))
	add := func(in []string) {
		for _, t := range in {
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			if _, dup := seen[t]; dup {
				continue
			}
			seen[t] = struct{}{}
			out = append(out, t)
		}
	}
	add(a)
	add(b)
	return out
}
