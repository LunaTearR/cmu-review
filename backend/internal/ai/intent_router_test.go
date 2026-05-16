package ai_test

import (
	"path/filepath"
	"sort"
	"testing"

	"cmu-review-backend/internal/adapter/intent"
	"cmu-review-backend/internal/ai"
)

// loadRouter wires the same shape main.go does, against the real
// configs/intent.json file checked into the repo. Failing to load is a
// hard test failure — we want to know if the file shape regresses.
func loadRouter(t *testing.T) *ai.IntentRouter {
	t.Helper()
	path, err := filepath.Abs("../../configs/intent.json")
	if err != nil {
		t.Fatalf("resolve intent.json path: %v", err)
	}
	mapper, err := intent.LoadFromFile(path)
	if err != nil {
		t.Fatalf("load intent.json: %v", err)
	}
	if mapper.PhraseCount() == 0 {
		t.Fatalf("intent.json loaded but PhraseCount=0 — config not picked up")
	}
	return ai.NewIntentRouter(
		ai.NewQueryPreprocessor(),
		ai.NewIntentClassifier(mapper),
		mapper,
	)
}

func sortedCopy(in []string) []string {
	out := append([]string(nil), in...)
	sort.Strings(out)
	return out
}

func sliceEq(a, b []string) bool {
	a, b = sortedCopy(a), sortedCopy(b)
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestIntentRouter_TaeFree(t *testing.T) {
	r := loadRouter(t)
	d := r.Route("ตัวฟรี")
	t.Logf("decision: kind=%s reason=%s cats=%v progs=%v tags=%v needs_embed=%v",
		d.Kind, d.Reason, d.Filter.Categories, d.Filter.Programs, d.Filter.Tags, d.NeedsEmbedding)

	if d.Kind != ai.IntentFilter {
		t.Errorf("kind: want IntentFilter, got %s (reason=%s)", d.Kind, d.Reason)
	}
	if d.NeedsEmbedding {
		t.Errorf("NeedsEmbedding: want false, got true")
	}
	wantCats := []string{"หมวดวิชาฟรี"}
	if !sliceEq(d.Filter.Categories, wantCats) {
		t.Errorf("categories: want %v, got %v", wantCats, d.Filter.Categories)
	}
	if len(d.Filter.Programs) != 0 {
		t.Errorf("programs: want empty, got %v", d.Filter.Programs)
	}
}

func TestIntentRouter_PhakPiset(t *testing.T) {
	r := loadRouter(t)
	d := r.Route("ภาคพิเศษ")
	t.Logf("decision: kind=%s reason=%s cats=%v progs=%v tags=%v needs_embed=%v",
		d.Kind, d.Reason, d.Filter.Categories, d.Filter.Programs, d.Filter.Tags, d.NeedsEmbedding)

	if d.Kind != ai.IntentFilter {
		t.Errorf("kind: want IntentFilter (program-only phrase), got %s (reason=%s)", d.Kind, d.Reason)
	}
	if d.NeedsEmbedding {
		t.Errorf("NeedsEmbedding: want false, got true")
	}
	wantProgs := []string{"ภาคพิเศษ"}
	if !sliceEq(d.Filter.Programs, wantProgs) {
		t.Errorf("programs: want %v, got %v (THIS WAS THE BUG — programs key was dropped at JSON parse)",
			wantProgs, d.Filter.Programs)
	}
}

func TestIntentRouter_OtherPrograms(t *testing.T) {
	r := loadRouter(t)
	cases := []struct {
		q    string
		want string
	}{
		{"ภาคปกติ", "ภาคปกติ"},
		{"นานาชาติ", "นานาชาติ"},
	}
	for _, tc := range cases {
		d := r.Route(tc.q)
		t.Logf("%q → kind=%s progs=%v", tc.q, d.Kind, d.Filter.Programs)
		if !sliceEq(d.Filter.Programs, []string{tc.want}) {
			t.Errorf("%q: programs=%v, want [%s]", tc.q, d.Filter.Programs, tc.want)
		}
	}
}

func TestIntentRouter_GE_caseInsensitive(t *testing.T) {
	r := loadRouter(t)
	// Uppercase input. Normalize lowercases it before Detect, so the
	// matcher must lower the phrase too. Pre-fix this returned empty.
	d := r.Route("GE")
	t.Logf("GE → kind=%s cats=%v", d.Kind, d.Filter.Categories)
	wantCats := []string{"หมวดวิชาเลือกทั่วไป (GE)"}
	if !sliceEq(d.Filter.Categories, wantCats) {
		t.Errorf("GE categories: want %v, got %v (case-bug regression)", wantCats, d.Filter.Categories)
	}
}

// TestIntentRouter_MultiIntentNoSpace exercises the trie-based extractor
// against the canonical real-world no-space query type users actually
// submit. Single pass must surface ALL configured phrases the input
// contains.
func TestIntentRouter_MultiIntentNoSpace(t *testing.T) {
	r := loadRouter(t)
	q := "ตัวGEภาคพิเศษเก็บAง่าย"
	d := r.Route(q)
	t.Logf("%q → kind=%s reason=%s cats=%v progs=%v tags=%v",
		q, d.Kind, d.Reason, d.Filter.Categories, d.Filter.Programs, d.Filter.Tags)

	wantCats := []string{"หมวดวิชาเลือกทั่วไป (GE)"}
	if !sliceEq(d.Filter.Categories, wantCats) {
		t.Errorf("categories: want %v, got %v", wantCats, d.Filter.Categories)
	}
	wantProgs := []string{"ภาคพิเศษ"}
	if !sliceEq(d.Filter.Programs, wantProgs) {
		t.Errorf("programs: want %v, got %v", wantProgs, d.Filter.Programs)
	}
	// "เก็บaง่าย" (after lowering) → grade_friendly → both tags.
	wantTagSubset := []string{"เหมาะกับคนอยากเก็บเกรด", "ส่งงานครบคะแนนไม่ยาก"}
	for _, want := range wantTagSubset {
		found := false
		for _, got := range d.Filter.Tags {
			if got == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing tag %q in %v", want, d.Filter.Tags)
		}
	}
}

func TestIntentRouter_TagOnlyPhrases(t *testing.T) {
	r := loadRouter(t)
	cases := []struct {
		q        string
		wantTag  string
		wantKind ai.IntentKind
	}{
		{"ไม่เช็คชื่อ", "ไม่เช็คชื่อ", ai.IntentFilter},
		{"งานน้อย", "งานน้อย ทำสบาย", ai.IntentFilter},
		{"เกรดดี", "เหมาะกับคนอยากเก็บเกรด", ai.IntentFilter},
	}
	for _, tc := range cases {
		d := r.Route(tc.q)
		t.Logf("%q → kind=%s tags=%v", tc.q, d.Kind, d.Filter.Tags)
		if d.Kind != tc.wantKind {
			t.Errorf("%q: kind=%s want=%s reason=%s", tc.q, d.Kind, tc.wantKind, d.Reason)
		}
		found := false
		for _, tag := range d.Filter.Tags {
			if tag == tc.wantTag {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("%q: want tag %q in %v", tc.q, tc.wantTag, d.Filter.Tags)
		}
	}
}
