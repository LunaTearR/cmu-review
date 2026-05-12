import { Link } from 'react-router-dom'
import type { Course } from '@/types/course'
import { Rating } from './Rating'

interface Props {
  course: Course
}

export function CourseCard({ course }: Props) {
  return (
    <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card course-card card-hover">
        <div className="cc-head">
          <span className="cc-code">{course.course_id}</span>
          <span className="tag tag-brand">{course.credits} หน่วยกิต</span>
        </div>
        <h3 className="cc-title line-clamp-2">{course.name_th}</h3>
        <div className="cc-title-en line-clamp-1">{course.name_en}</div>
        <div className="cc-meta">
          <span className="tag">{course.faculty.name_th}</span>
        </div>
        <div className="cc-foot">
          <div className="cc-stats">
            <Rating value={course.avg_rating} />
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
    </Link>
  )
}
