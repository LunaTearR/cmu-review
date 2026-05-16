package intent

import "strings"

// phraseTrie is a rune-keyed trie of intent phrases used to extract
// multiple intents from a single no-space user query (e.g.
// "ตัวGEภาคพิเศษเก็บAง่าย"). It replaces the previous strings.Contains
// loop with a single left-to-right longest-match scan.
//
// Why a trie:
//   - One pass over the input, O(N + sum_of_phrase_lengths).
//   - Longest-match at each position. "วิชาบังคับ" wins over a stray
//     "วิชา" if both are configured — without manual sorting.
//   - Emits ALL non-overlapping matches in a query, so multi-intent
//     phrases compose naturally.
//   - Pure stdlib, no external Thai tokenizer needed. Operates on runes
//     so it is script-blind: Thai, Latin, digit, mixed all work.
//
// Limitations (acceptable trade-offs):
//   - Substring match has no word boundary. "ge" embedded in
//     "engineering" would still match. We mitigate by curating the
//     intent.json phrase list — production data is short Thai queries,
//     not English prose.
//   - Tie-breaker between equal-length matches at the same position is
//     "last inserted wins" via the assign-merge in buildPhraseTrie.
//     Same JSON file controls order; not a hot path concern.

type trieNode struct {
	children map[rune]*trieNode
	// assign is non-nil at terminal nodes (end of a phrase). Holds the
	// (propertyName → propertyValue) pairs the phrase contributes.
	assign map[string]string
}

type phraseTrie struct {
	root *trieNode
}

// buildPhraseTrie compiles every phrase in `phrases` into the trie.
// Empty or whitespace-only matches are skipped. Phrases are lowered so
// the scan can run against a pre-lowered query (matching the contract
// in Detect).
func buildPhraseTrie(phrases []phraseEntry) *phraseTrie {
	t := &phraseTrie{root: &trieNode{children: map[rune]*trieNode{}}}
	for _, p := range phrases {
		m := strings.ToLower(strings.TrimSpace(p.Match))
		if m == "" {
			continue
		}
		n := t.root
		for _, r := range m {
			child, ok := n.children[r]
			if !ok {
				child = &trieNode{children: map[rune]*trieNode{}}
				n.children[r] = child
			}
			n = child
		}
		// Multiple JSON rows with the same `match` merge their assigns.
		// This is the documented way to map one phrase to several
		// properties (e.g. "ตัวเลือกเสรี" → both isFree and isGE).
		if n.assign == nil {
			n.assign = make(map[string]string, len(p.Assign))
		}
		for k, v := range p.Assign {
			n.assign[k] = v
		}
	}
	return t
}

// scanAll returns every non-overlapping longest match's assign block,
// in input order. `s` must already be lowercased by the caller (same
// invariant the trie itself was built under).
func (t *phraseTrie) scanAll(s string) []map[string]string {
	if t == nil || t.root == nil || s == "" {
		return nil
	}
	runes := []rune(s)
	var out []map[string]string
	for i := 0; i < len(runes); {
		n := t.root
		bestLen := 0
		var bestAssign map[string]string
		// Walk as far down the trie as the input allows. Remember the
		// DEEPEST terminal seen — that is the longest match starting
		// at position i. Greedy advance past it.
		for j := i; j < len(runes); j++ {
			child, ok := n.children[runes[j]]
			if !ok {
				break
			}
			n = child
			if n.assign != nil {
				bestLen = j - i + 1
				bestAssign = n.assign
			}
		}
		if bestLen > 0 {
			out = append(out, bestAssign)
			i += bestLen
			continue
		}
		i++
	}
	return out
}
