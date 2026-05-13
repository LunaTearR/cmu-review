import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Review } from '@/types/review'
import { PawRating } from './PawRating'
import { IconClose } from './Icons'

interface Props {
  review: Review | null
  courseCode: string
  courseName: string
  onClose: () => void
}

const SEMESTER_LABEL: Record<number, string> = { 1: 'เทอม 1', 2: 'เทอม 2', 3: 'ซัมเมอร์' }

const gradeColor = (g: string): string => {
  if (['A', 'A-'].includes(g)) return 'tag-mint'
  if (['B+', 'B', 'B-'].includes(g)) return 'tag-brand'
  if (['C+', 'C', 'C-'].includes(g)) return 'tag-amber'
  if (['D+', 'D', 'F'].includes(g)) return 'tag-rose'
  return ''
}

export function ReviewModal({ review, courseCode, courseName, onClose }: Props) {
  const [displayed, setDisplayed] = useState<Review | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (review) setDisplayed(review)
    else {
      const t = setTimeout(() => setDisplayed(null), 220)
      return () => clearTimeout(t)
    }
  }, [review])

  useEffect(() => { if (review) closeBtnRef.current?.focus() }, [review])

  useEffect(() => {
    if (!review) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [review, onClose])

  if (!displayed) return null

  const nick = displayed.reviewer_name || 'นักศึกษาไม่เปิดเผยชื่อ'
  const initial = (displayed.reviewer_name || '?')[0]
  const date = new Date(displayed.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-shell" role="dialog" aria-modal="true" aria-label="รายละเอียดรีวิว" style={{ padding: '32px 36px 36px' }}>
        <button ref={closeBtnRef} className="modal-close" onClick={onClose} aria-label="ปิด">
          <IconClose />
        </button>

        <div style={{ marginBottom: 18 }}>
          <div className="caption" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, color: 'var(--brand-deep)' }}>
            รีวิววิชา
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span className="cc-code" style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, background: 'var(--brand-tint)', color: 'var(--brand-ink)', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{courseCode}</span>
          </div>
          <h2 className="h-2" style={{ wordBreak: 'break-word' }}>{courseName}</h2>
        </div>

        <div className="review-head">
          <div className="review-author">
            <div className="avatar">{initial}</div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: 14.5 }}>{nick}</div>
              <div className="caption">{SEMESTER_LABEL[displayed.semester] ?? `ภาค ${displayed.semester}`}/{displayed.academic_year} · {date}</div>
            </div>
          </div>
          <PawRating value={displayed.rating} size={24} />
        </div>

        <div className="review-meta-chips" style={{ marginBottom: 16 }}>
          {displayed.grade && <span className={`tag ${gradeColor(displayed.grade)}`}>เกรด {displayed.grade}</span>}
          {displayed.professor && <span className="tag">อ. {displayed.professor}</span>}
          {displayed.program && <span className="tag">หลักสูตร{displayed.program}</span>}
          {displayed.category && <span className="tag">{displayed.category}</span>}
        </div>

        <p className="review-text" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {displayed.content}
        </p>
      </div>
    </div>,
    document.body,
  )
}
