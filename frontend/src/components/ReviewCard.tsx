import type { Review } from '@/types/review'
import { Rating } from './Rating'

interface Props {
  review: Review
  onClick?: () => void
}

const SEMESTER_LABEL: Record<number, string> = { 1: 'เทอมแรก', 2: 'เทอมสอง', 3: 'ซัมเมอร์' }

const chip = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  background: bg,
  color,
  padding: '0.125rem 0.5rem',
  borderRadius: 5,
  fontSize: '0.8rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
})

export function ReviewCard({ review, onClick }: Props) {
  const date = new Date(review.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  const interactive = !!onClick

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      onMouseEnter={interactive ? (e) => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(75,30,120,0.14)'
        e.currentTarget.style.borderColor = 'rgba(123,63,160,0.40)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      } : undefined}
      onMouseLeave={interactive ? (e) => {
        e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'
        e.currentTarget.style.borderColor = 'rgba(180,140,220,0.25)'
        e.currentTarget.style.transform = 'translateY(0)'
      } : undefined}
      style={{
        background: '#fff',
        border: '1px solid rgba(180,140,220,0.25)',
        borderRadius: 12,
        padding: '1rem 1.125rem',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minWidth: 0,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.18s',
        outline: 'none',
      }}
    >
      {/* Row 1: left group (rating + grade) / right group (semester) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
          <Rating value={review.rating} />
          {review.grade && (
            <span style={chip('var(--cmu-primary)', '#fff')}>เกรด {review.grade}</span>
          )}
        </div>
        <span style={{ fontSize: '0.875rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          ปี {review.academic_year} {SEMESTER_LABEL[review.semester]}
        </span>
      </div>

      {/* Row 2: meta chips */}
      {(review.professor || review.program || review.category) && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
          {review.professor && (
            <span style={{ ...chip('rgba(75,30,120,0.07)', 'var(--cmu-text-sub)'), maxWidth: '22ch' }}>
              👨‍🏫 {review.professor}
            </span>
          )}
          {review.program && (
            <span style={chip('rgba(201,162,39,0.10)', '#7a5c00')}>
              {review.program}
            </span>
          )}
          {review.category && (
            <span style={chip('rgba(0,0,0,0.05)', 'var(--cmu-text-muted)')}>
              {review.category}
            </span>
          )}
        </div>
      )}

      {/* Row 3: review content — 4-line clamp */}
      <p
        className="line-clamp-4"
        style={{ margin: 0, lineHeight: 1.7, color: 'var(--cmu-text)', fontSize: '1rem' }}
      >
        {review.content}
      </p>

      {/* Row 4: date */}
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap' }}>{date}</p>
    </div>
  )
}
