import type { Review } from '@/types/review'
import { Rating } from './Rating'

interface Props {
  review: Review
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
  // whiteSpace nowrap + maxWidth: chip stays single-line but never wider than parent
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
})

export function ReviewCard({ review }: Props) {
  const date = new Date(review.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(180,140,220,0.25)',
      borderRadius: 12,
      padding: '1rem 1.125rem',
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: 0, // prevents overflow in grid cell
    }}>
      {/* Row 1: left group (rating + grade) / right group (semester)
          Separated into two groups to prevent semester from being squeezed by flex:auto */}
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

      {/* Row 2: meta chips — flex-wrap handles multiple chips gracefully.
          Professor chip limited to max 22ch before truncating. */}
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

      {/* Row 3: review content — 4-line clamp.
          word-break: break-word handles long unbroken English strings. */}
      <p
        className="line-clamp-4"
        style={{ margin: 0, lineHeight: 1.7, color: 'var(--cmu-text)', fontSize: '1rem' }}
      >
        {review.content}
      </p>

      {/* Row 4: date — always single line */}
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap' }}>{date}</p>
    </div>
  )
}
