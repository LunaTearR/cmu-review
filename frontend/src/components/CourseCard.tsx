import { Link } from 'react-router-dom'
import type { Course } from '@/types/course'

interface Props {
  course: Course
}

export function CourseCard({ course }: Props) {
  return (
    <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(180,140,220,0.30)',
          borderRadius: 12,
          padding: '0.875rem 1rem',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0, // required: prevents flex child from overflowing its grid cell
          transition: 'box-shadow 0.18s, background 0.18s, border-color 0.18s',
          cursor: 'pointer',
          boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
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
        {/* Row 1: code + credits — single line, never wraps */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span className="truncate" style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--cmu-primary)', letterSpacing: '0.02em' }}>
            {course.course_id}
          </span>
          <span style={{
            fontSize: '0.875rem',
            background: 'var(--cmu-bg)',
            border: '1px solid var(--cmu-border)',
            color: 'var(--cmu-text-sub)',
            borderRadius: 5,
            padding: '0.1rem 0.5rem',
            fontWeight: 600,
            flexShrink: 0,     // badge never shrinks — it has fixed width
            whiteSpace: 'nowrap',
          }}>
            {course.credits} หน่วยกิต
          </span>
        </div>

        {/* Row 2: English name — 2-line clamp. Long names stay bounded. */}
        <div
          className="line-clamp-2"
          style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--cmu-text)', lineHeight: 1.35 }}
        >
          {course.name_en}
        </div>

        {/* Row 3: Thai name — 1-line clamp. Secondary label stays compact. */}
        <div
          className="line-clamp-1"
          style={{ fontSize: '0.9375rem', color: 'var(--cmu-text-sub)', marginTop: '0.2rem', lineHeight: 1.4 }}
        >
          {course.name_th}
        </div>

        {/* Row 4: faculty + rating — pinned to bottom.
            Faculty gets flex:1 + truncation so rating group never gets squeezed off. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.625rem', minWidth: 0 }}>
          <span
            className="truncate"
            style={{
              flex: 1,
              fontSize: '0.875rem',
              background: 'rgba(75,30,120,0.07)',
              color: 'var(--cmu-primary)',
              borderRadius: 5,
              padding: '0.15rem 0.5rem',
              fontWeight: 600,
            }}
          >
            {course.faculty.name_th}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            {course.review_count > 0 ? (
              <>
                <span style={{ color: 'var(--cmu-star)', fontWeight: 800, fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
                  ★ {course.avg_rating.toFixed(2)}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap' }}>
                  {course.review_count} รีวิว
                </span>
              </>
            ) : (
              <span style={{ fontSize: '0.875rem', color: 'var(--cmu-text-muted)', whiteSpace: 'nowrap' }}>ยังไม่มีรีวิว</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
