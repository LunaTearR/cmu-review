// Design tokens mapped from CSS vars. Use class names where possible; this is for inline edge cases.

export const C = {
  bg:           'var(--bg)',
  bgSoft:       'var(--bg-soft)',
  surface:      'var(--surface)',
  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',
  ink1:         'var(--ink-1)',
  ink2:         'var(--ink-2)',
  ink3:         'var(--ink-3)',
  ink4:         'var(--ink-4)',
  brand:        'var(--brand)',
  brandSoft:    'var(--brand-soft)',
  brandTint:    'var(--brand-tint)',
  brandDeep:    'var(--brand-deep)',
  brandInk:     'var(--brand-ink)',
  accentRose:   'var(--accent-rose)',
  accentAmber:  'var(--accent-amber)',
  accentMint:   'var(--accent-mint)',
} as const
