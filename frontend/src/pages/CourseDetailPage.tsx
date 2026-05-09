import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Course } from '@/types/course'
import type { Review } from '@/types/review'
import { fetchCourse } from '@/api/courses'
import { fetchReviews, createReview } from '@/api/reviews'
import { StarRating } from '@/components/StarRating'
import { ReviewCard } from '@/components/ReviewCard'
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
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-text-muted)' }}>กำลังโหลด...</div>
  )
  if (!course) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-error)', fontWeight: 600 }}>ไม่พบวิชานี้</div>
  )

  const pageBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: 8,
    border: '1px solid var(--cmu-border-strong)',
    background: disabled ? 'var(--cmu-bg)' : 'var(--cmu-bg-card)',
    color: disabled ? 'var(--cmu-text-muted)' : 'var(--cmu-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
  })

  return (
    <div>
      <Link to="/" style={{ color: 'var(--cmu-accent)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
        ← กลับ
      </Link>

      {/* Course header card */}
      <div style={{
        background: 'rgba(75, 30, 120, 0.68)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(201,162,39,0.35)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
        borderRadius: 14,
        padding: '1.5rem 1.75rem',
        marginTop: '1rem',
        marginBottom: '1.5rem',
        color: '#fff',
      }}>
        <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 600 }}>
          {course.course_id} &nbsp;·&nbsp; {course.credits} หน่วยกิต &nbsp;·&nbsp; {course.faculty.name_th}
        </span>
        <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 800 }}>{course.name_th}</h1>
        <p style={{ margin: '0.125rem 0 0', opacity: 0.85 }}>{course.name_en}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.875rem' }}>
          <StarRating value={Math.round(course.avg_rating)} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>{course.avg_rating.toFixed(1)}</span>
          <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>({course.review_count} รีวิว)</span>
        </div>

        {course.description && (
          <p style={{ marginTop: '0.875rem', opacity: 0.9, lineHeight: 1.6, fontSize: '0.925rem', marginBottom: 0 }}>
            {course.description}
          </p>
        )}
      </div>

      {/* Reviews section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--cmu-text)' }}>
          รีวิว <span style={{ color: 'var(--cmu-text-muted)', fontWeight: 400 }}>({total})</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '0.5rem 1.125rem',
            background: showForm ? 'transparent' : 'var(--cmu-primary)',
            color: showForm ? 'var(--cmu-primary)' : '#fff',
            border: `1px solid ${showForm ? 'var(--cmu-border-strong)' : 'var(--cmu-primary)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          {showForm ? 'ยกเลิก' : '+ เขียนรีวิว'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: '#fff',
          border: '1px solid rgba(180,140,220,0.35)',
          borderTop: '3px solid var(--cmu-gold)',
          borderRadius: 12,
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 12px rgba(75,30,120,0.10)',
        }}>
          <h3 style={{ margin: '0 0 1rem', color: 'var(--cmu-primary)', fontWeight: 800 }}>เขียนรีวิว</h3>
          <ReviewForm courseId={courseId} onSubmit={handleSubmitReview} />
        </div>
      )}

      {reviewsLoading ? (
        <p style={{ color: 'var(--cmu-text-muted)' }}>กำลังโหลดรีวิว...</p>
      ) : reviews.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2.5rem',
          color: 'var(--cmu-text-muted)',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid rgba(180,140,220,0.30)',
        }}>
          ยังไม่มีรีวิว เป็นคนแรกที่รีวิววิชานี้!
        </div>
      ) : (
        <>
          {reviews.map((rv) => <ReviewCard key={rv.id} review={rv} />)}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => loadReviews(page - 1)} disabled={page <= 1} style={pageBtn(page <= 1)}>
                ← ก่อนหน้า
              </button>
              <span style={{ padding: '0.375rem 0.75rem', color: 'var(--cmu-text-sub)', fontWeight: 600 }}>
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
  )
}
