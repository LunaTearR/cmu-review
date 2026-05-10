import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Review } from '@/types/review'
import { Rating } from './Rating'

interface Props {
  review: Review | null
  courseCode: string
  courseName: string
  onClose: () => void
}

const SEMESTER_LABEL: Record<number, string> = { 1: 'เทอมแรก', 2: 'เทอมสอง', 3: 'ซัมเมอร์' }

const chip = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  background: bg,
  color,
  padding: '0.2rem 0.625rem',
  borderRadius: 5,
  fontSize: '0.875rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
})

export function ReviewModal({ review, courseCode, courseName, onClose }: Props) {
  // `displayed` lags behind `review` so the panel stays mounted during exit animation.
  const [displayed, setDisplayed] = useState<Review | null>(null)
  const [open, setOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (review) {
      setDisplayed(review)
      // rAF ensures DOM is painted before we trigger the CSS transition.
      requestAnimationFrame(() => setOpen(true))
    } else {
      setOpen(false)
      const t = setTimeout(() => setDisplayed(null), 220)
      return () => clearTimeout(t)
    }
  }, [review])

  // Focus close button when modal opens.
  useEffect(() => {
    if (open) closeBtnRef.current?.focus()
  }, [open])

  // ESC to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!displayed) return null

  const date = new Date(displayed.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="รายละเอียดรีวิว"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,5,53,0.72)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 16,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 560,
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(180,140,220,0.20)',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(14px)',
          opacity: open ? 1 : 0,
          // Open: spring pop. Close: quick ease-out — no overshoot going away.
          transition: open
            ? 'transform 0.25s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease'
            : 'transform 0.18s ease-out, opacity 0.18s ease-out',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.125rem' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--cmu-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              รีวิววิชา
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--cmu-accent)', letterSpacing: '0.04em' }}>
              {courseCode}
            </p>
            <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.125rem', fontWeight: 800, color: 'var(--cmu-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
              {courseName}
            </h2>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.875rem', color: 'var(--cmu-text-sub)', fontWeight: 600 }}>
              👤 {displayed.reviewer_name || 'ไม่ระบุชื่อ'}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            style={{
              flexShrink: 0,
              background: 'rgba(0,0,0,0.055)',
              border: 'none',
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.375rem',
              lineHeight: 1,
              color: 'var(--cmu-text-muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(75,30,120,0.10)'
              e.currentTarget.style.color = 'var(--cmu-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.055)'
              e.currentTarget.style.color = 'var(--cmu-text-muted)'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ height: 1, background: 'rgba(180,140,220,0.18)', marginBottom: '1.125rem' }} />

        {/* ── Rating + semester ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <Rating value={displayed.rating} />
            <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--cmu-text)' }}>
              {displayed.rating} / 5
            </span>
            {displayed.grade && (
              <span style={chip('var(--cmu-primary)', '#fff')}>เกรด {displayed.grade}</span>
            )}
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap' }}>
            ปี {displayed.academic_year} {SEMESTER_LABEL[displayed.semester]}
          </span>
        </div>

        {/* ── Meta chips ── */}
        {(displayed.professor || displayed.program || displayed.category) && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1.125rem' }}>
            {displayed.professor && (
              <span style={chip('rgba(75,30,120,0.07)', 'var(--cmu-text-sub)')}>
                👨‍🏫 {displayed.professor}
              </span>
            )}
            {displayed.program && (
              <span style={chip('rgba(201,162,39,0.10)', '#7a5c00')}>
                {displayed.program}
              </span>
            )}
            {displayed.category && (
              <span style={chip('rgba(0,0,0,0.05)', 'var(--cmu-text-muted)')}>
                {displayed.category}
              </span>
            )}
          </div>
        )}

        {/* ── Full review content — no clamp, preserve line breaks ── */}
        <p style={{
          margin: 0,
          lineHeight: 1.8,
          color: 'var(--cmu-text)',
          fontSize: '1rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {displayed.content}
        </p>

        {/* ── Date ── */}
        <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: 'var(--cmu-text-muted)' }}>
          {date}
        </p>
      </div>
    </div>,
    document.body,
  )
}
