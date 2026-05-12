import type { Review } from '@/types/review'
import { Rating } from './Rating'

interface Props {
  review: Review
  onClick?: () => void
}

const SEMESTER_LABEL: Record<number, string> = { 1: 'เทอม 1', 2: 'เทอม 2', 3: 'ซัมเมอร์' }

const gradeColor = (g: string): string => {
  if (['A', 'A-'].includes(g)) return 'tag-mint'
  if (['B+', 'B', 'B-'].includes(g)) return 'tag-brand'
  if (['C+', 'C', 'C-'].includes(g)) return 'tag-amber'
  if (['D+', 'D', 'F'].includes(g)) return 'tag-rose'
  return ''
}

export function ReviewCard({ review, onClick }: Props) {
  const nick = review.reviewer_name || 'นักศึกษาไม่เปิดเผยชื่อ'
  const initial = (review.reviewer_name || '?')[0]
  const interactive = !!onClick

  return (
    <article
      className={`review ${interactive ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
    >
      <div className="review-head">
        <div className="review-author">
          <div className="avatar">{initial}</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: 14.5 }}>{nick}</div>
            <div className="caption">รีวิวเมื่อ{SEMESTER_LABEL[review.semester] ?? `ภาค ${review.semester}`}/{review.academic_year}</div>
          </div>
        </div>
        <Rating value={review.rating} size="lg" />
      </div>

      <div className="review-meta-chips">
        {review.grade && <span className={`tag ${gradeColor(review.grade)}`}>เกรด {review.grade}</span>}
        {review.professor && <span className="tag">อ. {review.professor}</span>}
        {review.program && <span className="tag">หลักสูตร{review.program}</span>}
        {review.category && <span className="tag">{review.category}</span>}
      </div>

      <p className="review-text line-clamp-4" style={{ marginTop: 16, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {review.content}
      </p>
    </article>
  )
}
