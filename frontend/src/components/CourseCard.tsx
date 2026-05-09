import { Link } from 'react-router-dom'
import type { Course } from '@/types/course'

interface Props {
  course: Course
}

export function CourseCard({ course }: Props) {
  return (
    <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(180,140,220,0.30)',
          borderRadius: 12,
          padding: '0.875rem 1.125rem',
          marginBottom: '0.625rem',
          transition: 'box-shadow 0.18s, background 0.18s, border-color 0.18s',
          cursor: 'pointer',
          boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#faf7fd'
          e.currentTarget.style.boxShadow = '0 4px 18px rgba(75,30,120,0.13)'
          e.currentTarget.style.borderColor = 'rgba(123,63,160,0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff'
          e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'
          e.currentTarget.style.borderColor = 'rgba(180,140,220,0.30)'
        }}
      >
        {/* Row 1: code + credits */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--cmu-primary)', letterSpacing: '0.02em' }}>
            {course.course_id}
          </span>
          <span style={{
            fontSize: '0.75rem',
            background: 'var(--cmu-bg)',
            border: '1px solid var(--cmu-border)',
            color: 'var(--cmu-text-sub)',
            borderRadius: 5,
            padding: '0.1rem 0.5rem',
            fontWeight: 600,
          }}>
            {course.credits} หน่วยกิต
          </span>
        </div>

        {/* Row 2: English name (main title) */}
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cmu-text)', lineHeight: 1.3 }}>
          {course.name_en}
        </div>

        {/* Row 3: Thai name */}
        <div style={{ fontSize: '0.875rem', color: 'var(--cmu-text-sub)', marginTop: '0.1rem' }}>
          {course.name_th}
        </div>

        {/* Row 4: faculty + rating */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem' }}>
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(75,30,120,0.07)',
            color: 'var(--cmu-primary)',
            borderRadius: 5,
            padding: '0.15rem 0.5rem',
            fontWeight: 600,
          }}>
            {course.faculty.name_th}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {course.review_count > 0 ? (
              <>
                <span style={{ color: 'var(--cmu-star)', fontWeight: 800, fontSize: '0.9rem' }}>
                  ★ {course.avg_rating.toFixed(2)}
                </span>
                <span style={{ fontSize: '0.775rem', color: 'var(--cmu-text-muted)' }}>
                  {course.review_count} รีวิว
                </span>
              </>
            ) : (
              <span style={{ fontSize: '0.775rem', color: 'var(--cmu-text-muted)' }}>ยังไม่มีรีวิว</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
