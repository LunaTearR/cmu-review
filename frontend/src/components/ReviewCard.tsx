import type { Review } from '@/types/review'
import { StarRating } from './StarRating'

interface Props {
  review: Review
}

const SEMESTER_LABEL: Record<number, string> = { 1: 'เทอมแรก', 2: 'เทอมสอง', 3: 'ซัมเมอร์' }

export function ReviewCard({ review }: Props) {
  const date = new Date(review.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(180,140,220,0.30)',
      borderRadius: 12,
      padding: '1rem 1.125rem',
      marginBottom: '0.75rem',
      boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <StarRating value={review.rating} />
        {review.grade && (
          <span style={{
            background: 'var(--cmu-primary)',
            color: '#fff',
            padding: '0.1rem 0.5rem',
            borderRadius: 5,
            fontSize: '0.775rem',
            fontWeight: 700,
          }}>
            เกรด {review.grade}
          </span>
        )}
        <span style={{ fontSize: '0.8rem', color: 'var(--cmu-text-muted)' }}>
          ปี {review.academic_year} &nbsp;{SEMESTER_LABEL[review.semester]}
        </span>
      </div>
      <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--cmu-text)' }}>{review.content}</p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--cmu-text-muted)' }}>{date}</p>
    </div>
  )
}
