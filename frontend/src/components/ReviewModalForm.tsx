import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import type { Course } from '@/types/course'
import type { CreateReviewPayload, Review } from '@/types/review'
import { fetchCourse, fetchCourses } from '@/api/courses'
import { createReview } from '@/api/reviews'
import { ReviewForm } from './ReviewForm'
import { IconSearch } from './Icons'

interface Props {
  preselectCourseId?: number
  onSuccess: (review: Review, courseId: number) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function ReviewModalForm({ preselectCourseId, onSuccess, onCancel, onDirtyChange }: Props) {
  const [course, setCourse] = useState<Course | null>(null)
  const [courseQuery, setCourseQuery] = useState('')
  const [showDD, setShowDD] = useState(false)
  const [results, setResults] = useState<Course[]>([])
  const [loadingCourse, setLoadingCourse] = useState(false)
  const [locked, setLocked] = useState(false)
  const [formDirty, setFormDirty] = useState(false)

  const pickerDirty = !preselectCourseId && (!!course || courseQuery.trim().length > 0)

  useEffect(() => {
    onDirtyChange?.(pickerDirty || formDirty)
  }, [pickerDirty, formDirty, onDirtyChange])

  useEffect(() => {
    if (preselectCourseId) {
      setLoadingCourse(true)
      fetchCourse(preselectCourseId)
        .then(c => {
          setCourse(c)
          setCourseQuery(`${c.course_id} — ${c.name_th}`)
          setLocked(true)
        })
        .catch(console.error)
        .finally(() => setLoadingCourse(false))
    }
  }, [preselectCourseId])

  useEffect(() => {
    if (!courseQuery || course || locked) { setResults([]); return }
    const t = setTimeout(() => {
      fetchCourses({ search: courseQuery, limit: 8, page: 1 })
        .then(r => setResults(r.data))
        .catch(console.error)
    }, 200)
    return () => clearTimeout(t)
  }, [courseQuery, course, locked])

  const pickCourse = (c: Course) => {
    setCourse(c)
    setCourseQuery(`${c.course_id} — ${c.name_th}`)
    setShowDD(false)
    setLocked(true)
  }

  const confirmCourse = () => {
    if (!course) return
    setLocked(true)
    setShowDD(false)
  }

  const handleSubmit = async (payload: CreateReviewPayload) => {
    if (!course) return
    const created = await createReview(course.id, payload)
    onSuccess(created, course.id)
  }

  return (
    <div>
      <h1 className="h-1" style={{ marginBottom: 8 }}>เขียนรีวิววิชา</h1>
      <p className="body" style={{ color: 'var(--ink-3)', marginBottom: 24, maxWidth: 600 }}>
        แชร์ประสบการณ์ของคุณ ช่วยให้รุ่นน้องเลือกวิชาที่ใช่ก่อนลงทะเบียน
      </p>

      <div className="form-section">
        <div className="form-section-title">วิชาที่จะรีวิว</div>
        <div className="field" style={{ position: 'relative' }}>
          <label className="field-label">
            เลือกวิชา <span className="req">*</span>
          </label>
          <div
            className={`search-hero${locked ? ' is-locked' : ''}`}
            style={{ padding: '4px 6px 4px 16px', border: '1px solid var(--border-strong)' }}
            aria-disabled={locked}
          >
            <IconSearch width="16" height="16" />
            <input
              placeholder="พิมพ์รหัส หรือชื่อวิชา"
              value={courseQuery}
              onChange={(e) => { setCourseQuery(e.target.value); setCourse(null); setShowDD(true) }}
              onFocus={() => { if (!locked) setShowDD(true) }}
              disabled={locked}
              readOnly={locked}
              aria-readonly={locked}
            />
            {locked ? (
              <span className="lock-badge" aria-label="ล็อกวิชาแล้ว">
                <FontAwesomeIcon icon={faLock} /> ล็อก
              </span>
            ) : course ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setCourse(null); setCourseQuery(''); setShowDD(true) }}
              >
                เปลี่ยน
              </button>
            ) : null}
          </div>
          {showDD && !course && !locked && results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 10, overflow: 'hidden',
            }}>
              {results.map(c => (
                <div
                  key={c.id}
                  onClick={() => pickCourse(c)}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 6, background: 'var(--brand-tint)', color: 'var(--brand-ink)', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>
                    {c.course_id}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-1)', wordBreak: 'break-word' }}>{c.name_th}</div>
                    <div className="caption" style={{ wordBreak: 'break-word' }}>{c.name_en}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {courseQuery && !course && !locked && !loadingCourse && results.length === 0 && (
            <div className="field-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ไม่พบวิชาในระบบ</span>
              <Link to="/courses/new" onClick={onCancel}>เพิ่มวิชาใหม่ →</Link>
            </div>
          )}
        </div>

        {course && !locked && (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={confirmCourse}>
              รีวิวรายวิชานี้
            </button>
          </div>
        )}
      </div>

      {!locked || !course ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <div className="body-sm">
            {course ? 'กดปุ่ม "รีวิวรายวิชานี้" เพื่อเริ่มเขียนรีวิว' : 'เลือกวิชาก่อนเขียนรีวิว'}
          </div>
        </div>
      ) : (
        <ReviewForm courseId={course.id} onSubmit={handleSubmit} onCancel={onCancel} onDirtyChange={setFormDirty} />
      )}
    </div>
  )
}
