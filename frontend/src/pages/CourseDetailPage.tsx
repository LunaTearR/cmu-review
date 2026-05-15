import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Course, CourseInsight } from '@/types/course'
import type { Review } from '@/types/review'
import { fetchCourse, fetchCourseInsights } from '@/api/courses'
import { fetchReviews } from '@/api/reviews'
import { PawRating } from '@/components/PawRating'
import { ReviewCard } from '@/components/ReviewCard'
import { ReviewModal } from '@/components/ReviewModal'
import { AISummaryCard } from '@/components/AISummaryCard'
import { CourseInsightPanel } from '@/components/CourseInsightPanel'
import { IconBack, IconPen } from '@/components/Icons'
import { useReviewModal } from '@/context/ReviewModalContext'
import { useDataRefresh } from '@/context/DataRefreshContext'

const LIMIT = 20

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const courseId = Number(id)
  const navigate = useNavigate()
  const { open: openReview } = useReviewModal()
  const { coursesV, reviewsV } = useDataRefresh()

  const [course, setCourse] = useState<Course | null>(null)
  const [insight, setInsight] = useState<CourseInsight | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [courseLoading, setCourseLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent')

  useEffect(() => {
    setCourseLoading(true)
    fetchCourse(courseId).then(setCourse).catch(console.error).finally(() => setCourseLoading(false))
  }, [courseId, coursesV])

  useEffect(() => {
    fetchCourseInsights(courseId).then(setInsight).catch(console.error)
  }, [courseId, reviewsV])

  const loadReviews = useCallback(async (p: number) => {
    setReviewsLoading(true)
    try {
      const res = await fetchReviews(courseId, p, LIMIT)
      setReviews(res.data); setTotal(res.total); setPage(p)
    } catch (err) {
      console.error(err)
    } finally {
      setReviewsLoading(false)
    }
  }, [courseId])

  useEffect(() => { loadReviews(1) }, [courseId, reviewsV, loadReviews])

  const optimisticAddReview = useCallback((review: Review) => {
    setReviews(prev => [review, ...prev])
    setTotal(prev => prev + 1)
    setCourse(prev => prev ? {
      ...prev,
      avg_rating: (prev.avg_rating * prev.review_count + review.rating) / (prev.review_count + 1),
      review_count: prev.review_count + 1,
    } : prev)
  }, [])

  const sortedReviews = useMemo(() => {
    const arr = [...reviews]
    if (sort === 'recent') arr.sort((a, b) => (b.academic_year * 10 + b.semester) - (a.academic_year * 10 + a.semester))
    if (sort === 'high') arr.sort((a, b) => b.rating - a.rating)
    if (sort === 'low')  arr.sort((a, b) => a.rating - b.rating)
    return arr
  }, [sort, reviews])

  const totalPages = Math.ceil(total / LIMIT)

  const gradeDist = useMemo(() => {
    const grades = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']
    return grades.map(g => ({ g, count: reviews.filter(r => r.grade === g).length }))
  }, [reviews])
  const maxGrade = Math.max(1, ...gradeDist.map(x => x.count))
  const recommend = useMemo(() => {
    if (!reviews.length) return 0
    return Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100)
  }, [reviews])

  if (courseLoading) return <div className="shell empty-state">กำลังโหลด...</div>
  if (!course) return <div className="shell empty-state" style={{ color: 'var(--accent-rose)' }}>ไม่พบวิชานี้</div>

  return (
    <div className="fade-in">
      <div className="detail-hero">
        <div className="shell">
          <button
            onClick={() => navigate(-1)}
            className="caption"
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', marginBottom: 16, background: 'none', border: 0 }}
          >
            <IconBack /> กลับ
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <span className="cc-code" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 6, background: 'var(--brand-tint)', color: 'var(--brand-ink)', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
              {course.course_id}
            </span>
            <span className="tag tag-brand">{course.faculty.name_th}</span>
            <span className="tag">{course.credits} หน่วยกิต</span>
          </div>

          <h1 className="h-display" style={{ marginBottom: 8, maxWidth: 800, textWrap: 'balance' }}>{course.name_th}</h1>
          <p className="body-lg" style={{ color: 'var(--ink-3)', marginBottom: 18 }}>{course.name_en}</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: 'var(--ink-1)' }}>
              {course.avg_rating.toFixed(1)}
            </span>
            <PawRating value={course.avg_rating} size={22} />
            <span className="caption">จาก {course.review_count} รีวิว</span>
            {course.review_count > 0 && (
              <span className="caption" style={{ color: 'var(--brand-deep)', fontWeight: 600 }}>
                · {recommend}% แนะนำ
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => openReview({ courseId: course.id, onSuccess: optimisticAddReview })}>
              <IconPen /> เขียนรีวิววิชานี้
            </button>
          </div>
        </div>
      </div>

      <div className="shell detail-layout">
        <div>
          {(course.description || course.prerequisite) && (
            <section style={{ marginBottom: 36 }}>
              {course.description && (
                <>
                  <h2 className="h-2" style={{ marginBottom: 12 }}>คำอธิบายรายวิชา</h2>
                  <p className="body-lg" style={{ color: 'var(--ink-2)', lineHeight: 1.8, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>
                    {course.description}
                  </p>
                </>
              )}
              {course.prerequisite && (
                <div style={{ marginTop: 18, padding: 16, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                  <div className="caption" style={{ marginBottom: 4, fontWeight: 600, color: 'var(--brand-deep)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    เงื่อนไขที่ต้องผ่านก่อนเรียน
                  </div>
                  <div className="body" style={{ color: 'var(--ink-1)' }}>{course.prerequisite}</div>
                </div>
              )}
            </section>
          )}

          <section>
            {course.review_count >= 5 && course.ai_summary && (
              <AISummaryCard summary={course.ai_summary} />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <h2 className="h-2">
                รีวิวจากนักศึกษา <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>({total})</span>
              </h2>
              <div className="seg">
                <button className={sort === 'recent' ? 'is-active' : ''} onClick={() => setSort('recent')}>ล่าสุด</button>
                <button className={sort === 'high' ? 'is-active' : ''} onClick={() => setSort('high')}>คะแนนสูง</button>
                <button className={sort === 'low'  ? 'is-active' : ''} onClick={() => setSort('low')}>คะแนนต่ำ</button>
              </div>
            </div>

            {reviewsLoading ? (
              <div className="empty-state">กำลังโหลดรีวิว...</div>
            ) : sortedReviews.length === 0 ? (
              <div className="empty-state card">
                <div style={{ fontSize: 32, marginBottom: 8 }}>💜</div>
                <div className="h-3" style={{ marginBottom: 6 }}>ยังไม่มีรีวิววิชานี้</div>
                <div className="body-sm" style={{ marginBottom: 16 }}>เป็นคนแรกที่แชร์ประสบการณ์</div>
                <button className="btn btn-primary" onClick={() => openReview({ courseId: course.id, onSuccess: optimisticAddReview })}>
                  <IconPen /> เขียนรีวิวแรก
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sortedReviews.map(r => (
                  <ReviewCard key={r.id} review={r} onClick={() => setSelectedReview(r)} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => loadReviews(page - 1)}>← ก่อนหน้า</button>
                <span className="caption" style={{ padding: '0 8px' }}>{page} / {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => loadReviews(page + 1)}>ถัดไป →</button>
              </div>
            )}
          </section>
        </div>

        <aside>
          <div className="detail-sticky">
            <div className="card card-pad">
              <div className="caption" style={{ marginBottom: 10 }}>คะแนนเฉลี่ย</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: 'var(--ink-1)' }}>
                  {course.avg_rating.toFixed(1)}
                </span>
                <span className="body-sm">/ 5.0</span>
              </div>
              <div style={{ margin: '10px 0 14px' }}>
                <PawRating value={course.avg_rating} size={26} />
              </div>
              <div className="caption">จาก {course.review_count} รีวิว</div>

              {course.review_count > 0 && (
                <>
                  <hr className="divider" style={{ margin: '16px 0' }} />
                  <div className="caption" style={{ marginBottom: 8 }}>แนะนำให้คนอื่นลงไหม</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)' }}>{recommend}%</span>
                    <span className="caption">แนะนำ</span>
                  </div>
                  <div className="recbar"><div className="recbar-fill" style={{ width: `${recommend}%` }} /></div>
                </>
              )}
            </div>

            {insight && <CourseInsightPanel insight={insight} />}

            {reviews.length > 0 && (
              <div className="card card-pad">
                <div className="caption" style={{ marginBottom: 12 }}>การกระจายของเกรด</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {gradeDist.map(({ g, count }) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="mono" style={{ width: 24, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{g}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-soft)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxGrade) * 100}%`, height: '100%', background: 'var(--brand)', borderRadius: 999 }} />
                      </div>
                      <span className="caption mono" style={{ width: 16, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card card-pad" style={{ background: 'var(--bg-soft)' }}>
              <div className="caption" style={{ marginBottom: 4 }}>เคยเรียนวิชานี้?</div>
              <div className="body-sm" style={{ color: 'var(--ink-1)', marginBottom: 12 }}>แชร์ประสบการณ์ให้รุ่นน้อง</div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openReview({ courseId: course.id, onSuccess: optimisticAddReview })}>
                <IconPen /> เขียนรีวิว
              </button>
            </div>
          </div>
        </aside>
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
