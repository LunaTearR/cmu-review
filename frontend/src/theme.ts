export const C = {
  primary:      'var(--cmu-primary)',
  primaryDark:  'var(--cmu-primary-dark)',
  accent:       'var(--cmu-accent)',
  gold:         'var(--cmu-gold)',
  goldLight:    'var(--cmu-gold-light)',
  bg:           'var(--cmu-bg)',
  bgCard:       'var(--cmu-bg-card)',
  border:       'var(--cmu-border)',
  borderStrong: 'var(--cmu-border-strong)',
  text:         'var(--cmu-text)',
  textSub:      'var(--cmu-text-sub)',
  textMuted:    'var(--cmu-text-muted)',
  star:         'var(--cmu-star)',
  starEmpty:    'var(--cmu-star-empty)',
  error:        'var(--cmu-error)',
  success:      'var(--cmu-success)',
  successBg:    'var(--cmu-success-bg)',
  successBorder:'var(--cmu-success-border)',
} as const

export const glass: React.CSSProperties = {
  background: 'var(--cmu-bg-card)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid var(--cmu-border)',
  borderRadius: 12,
}

export const input: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--cmu-input-border)',
  background: 'var(--cmu-input-bg)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  color: 'var(--cmu-text)',
}
