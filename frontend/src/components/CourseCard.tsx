import { Link } from 'react-router-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Course } from '@/types/course'
import { PawRating } from './PawRating'

interface Props {
  course: Course
}

export function CourseCard({ course }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const check = () => {
      const t = titleRef.current
      const s = subRef.current
      const tOver = !!t && t.scrollHeight > t.clientHeight + 1
      const sOver = !!s && s.scrollHeight > s.clientHeight + 1
      setTruncated(tOver || sOver)
    }
    check()
    const ro = new ResizeObserver(check)
    if (titleRef.current) ro.observe(titleRef.current)
    if (subRef.current) ro.observe(subRef.current)
    return () => ro.disconnect()
  }, [course.name_th, course.name_en])

  useLayoutEffect(() => {
    if (!hovered || !truncated || !anchorRef.current) {
      setPos(null)
      return
    }
    const r = anchorRef.current.getBoundingClientRect()
    const halfW = 170
    const margin = 8
    const cx = Math.max(halfW + margin, Math.min(window.innerWidth - halfW - margin, r.left + r.width / 2))
    setPos({ top: r.top - 10, left: cx })
  }, [hovered, truncated])

  const showTip = hovered && truncated && pos

  return (
    <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card course-card card-hover">
        <div className="cc-head">
          <span className="cc-code">{course.course_id}</span>
          <span className="tag tag-brand">{course.credits} หน่วยกิต</span>
        </div>
        <div
          className="cc-titles"
          ref={anchorRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <h3 ref={titleRef} className="cc-title line-clamp-2">{course.name_th}</h3>
          <div ref={subRef} className="cc-title-en line-clamp-1">{course.name_en}</div>
        </div>
        <div className="cc-meta">
          <span className="tag">{course.faculty.name_th}</span>
        </div>
        <div className="cc-foot">
          <div className="cc-stats">
            <PawRating value={course.avg_rating} />
            {course.review_count > 0 ? (
              <span className="body-sm mono" style={{ color: 'var(--ink-1)', fontWeight: 600 }}>
                {course.avg_rating.toFixed(1)}
              </span>
            ) : (
              <span className="caption">ยังไม่มีรีวิว</span>
            )}
          </div>
          <span className="caption">{course.review_count} รีวิว</span>
        </div>
      </div>

      {showTip && createPortal(
        <div className="cc-tip" style={{ top: pos.top, left: pos.left }} role="tooltip">
          <div className="cc-tip-th">{course.name_th}</div>
          <div className="cc-tip-en">{course.name_en}</div>
        </div>,
        document.body,
      )}
    </Link>
  )
}
