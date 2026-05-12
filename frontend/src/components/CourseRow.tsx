import { Link } from 'react-router-dom'
import type { Course } from '@/types/course'
import { Rating } from './Rating'

interface Props {
  course: Course
}

export function CourseRow({ course }: Props) {
  return (
    <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="course-row">
        <span className="cc-code">{course.course_id}</span>
        <div style={{ minWidth: 0 }}>
          <div className="cr-title truncate">{course.name_th}</div>
          <div className="cr-sub truncate">
            {course.name_en} · {course.faculty.name_th} · {course.credits} หน่วยกิต
          </div>
        </div>
        <span className="tag tag-brand">{course.credits} หน่วยกิต</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 130, justifyContent: 'flex-end' }}>
          <Rating value={course.avg_rating} />
          <span className="caption" style={{ minWidth: 56, textAlign: 'right' }}>
            {course.review_count} รีวิว
          </span>
        </div>
      </div>
    </Link>
  )
}
