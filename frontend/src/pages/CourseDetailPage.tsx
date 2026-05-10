import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Course } from '@/types/course'
import type { Review } from '@/types/review'
import { fetchCourse } from '@/api/courses'
import { fetchReviews, createReview } from '@/api/reviews'
import { Rating } from '@/components/Rating'
import { ReviewCard } from '@/components/ReviewCard'
import { ReviewModal } from '@/components/ReviewModal'
import { ReviewForm } from '@/components/ReviewForm'
import type { CreateReviewPayload } from '@/types/review'

const LIMIT = 20

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const courseId = Number(id)

  const [course, setCourse] = useState<Course | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [courseLoading, setCourseLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)

  useEffect(() => {
    fetchCourse(courseId)
      .then(setCourse)
      .catch(console.error)
      .finally(() => setCourseLoading(false))
  }, [courseId])

  const loadReviews = async (p: number) => {
    setReviewsLoading(true)
    try {
      const res = await fetchReviews(courseId, p, LIMIT)
      setReviews(res.data)
      setTotal(res.total)
      setPage(p)
    } catch (err) {
      console.error(err)
    } finally {
      setReviewsLoading(false)
    }
  }

  useEffect(() => { loadReviews(1) }, [courseId])

  const handleSubmitReview = async (payload: CreateReviewPayload) => {
    await createReview(courseId, payload)
    setShowForm(false)
    await loadReviews(1)
    fetchCourse(courseId).then(setCourse).catch(console.error)
  }

  const totalPages = Math.ceil(total / LIMIT)

  if (courseLoading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-text-muted)', fontSize: '0.9375rem' }}>กำลังโหลด...</div>
  )
  if (!course) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-error)', fontWeight: 600, fontSize: '0.9375rem' }}>ไม่พบวิชานี้</div>
  )

  const pageBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '0.4rem 1rem',
    borderRadius: 8,
    border: '1px solid var(--cmu-border-strong)',
    background: disabled ? 'var(--cmu-bg)' : 'var(--cmu-bg-card)',
    color: disabled ? 'var(--cmu-text-muted)' : 'var(--cmu-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '0.9375rem',
  })

  return (
    <div>
      <Link to="/" style={{ color: 'var(--cmu-accent)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 600 }}>
        ← กลับ
      </Link>

      <div className="detail-layout" style={{ marginTop: '1rem' }}>

        {/* ── Sidebar: course info + write review ── */}
        <div className="detail-sidebar">
          <div style={{
            background: 'rgba(75, 30, 120, 0.68)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(201,162,39,0.35)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
            borderRadius: 14,
            padding: '1.375rem 1.5rem',
            marginBottom: '0.875rem',
            color: '#fff',
          }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.85, fontWeight: 600 }}>
              {course.course_id} &nbsp;·&nbsp; {course.credits} หน่วยกิต &nbsp;·&nbsp; {course.faculty.name_th}
            </span>
            <h1 style={{ margin: '0.3rem 0 0', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3 }}>{course.name_th}</h1>
            <p style={{ margin: '0.2rem 0 0', opacity: 0.85, fontSize: '0.9375rem', lineHeight: 1.5 }}>{course.name_en}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.875rem' }}>
              <Rating value={Math.round(course.avg_rating)} />
              <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>{course.avg_rating.toFixed(1)}</span>
              <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>({course.review_count} รีวิว)</span>
            </div>

            {course.description && (
              <p style={{ marginTop: '0.875rem', opacity: 0.9, lineHeight: 1.65, fontSize: '0.9375rem', marginBottom: 0 }}>
                {course.description}
              </p>
            )}
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              width: '100%',
              padding: '0.675rem 1rem',
              background: showForm ? 'transparent' : 'var(--cmu-primary)',
              color: showForm ? 'var(--cmu-primary)' : '#fff',
              border: `1px solid ${showForm ? 'var(--cmu-border-strong)' : 'var(--cmu-primary)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9375rem',
              transition: 'all 0.15s',
              marginBottom: showForm ? '0.875rem' : 0,
            }}
          >
            {showForm ? 'ยกเลิก' : '+ เขียนรีวิว'}
          </button>

          {showForm && (
            <div style={{
              background: '#fff',
              border: '1px solid rgba(180,140,220,0.35)',
              borderTop: '3px solid var(--cmu-gold)',
              borderRadius: 12,
              padding: '1.25rem',
              boxShadow: '0 2px 12px rgba(75,30,120,0.10)',
            }}>
              <h3 style={{ margin: '0 0 0.875rem', color: 'var(--cmu-primary)', fontWeight: 800, fontSize: '1.125rem' }}>เขียนรีวิว</h3>
              <ReviewForm courseId={courseId} onSubmit={handleSubmitReview} />
            </div>
          )}
        </div>

        {/* ── Main: reviews ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1875rem', fontWeight: 700, color: 'var(--cmu-text)' }}>
              รีวิวทั้งหมด{' '}
              <span style={{ color: 'var(--cmu-text-muted)', fontWeight: 400, fontSize: '1rem' }}>({total})</span>
            </h2>
          </div>

          {reviewsLoading ? (
            <p style={{ color: 'var(--cmu-text-muted)', fontSize: '0.9375rem' }}>กำลังโหลดรีวิว...</p>
          ) : reviews.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem',
              color: 'var(--cmu-text-muted)',
              fontSize: '0.9375rem',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid rgba(180,140,220,0.30)',
            }}>
              ยังไม่มีรีวิว เป็นคนแรกที่รีวิววิชานี้!
            </div>
          ) : (
            <>
              <div className="review-grid">
                {reviews.map((rv) => (
                  <ReviewCard key={rv.id} review={rv} onClick={() => setSelectedReview(rv)} />
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'center', alignItems: 'center' }}>
                  <button onClick={() => loadReviews(page - 1)} disabled={page <= 1} style={pageBtn(page <= 1)}>
                    ← ก่อนหน้า
                  </button>
                  <span style={{ padding: '0.4rem 0.75rem', color: 'var(--cmu-text-sub)', fontWeight: 600, fontSize: '0.9375rem' }}>
                    {page} / {totalPages}
                  </span>
                  <button onClick={() => loadReviews(page + 1)} disabled={page >= totalPages} style={pageBtn(page >= totalPages)}>
                    ถัดไป →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ReviewModal
        review={selectedReview}
        courseCode={course.course_id}
        courseName={course.name_th}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  )
}
