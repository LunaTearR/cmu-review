import type { Faculty } from './faculty'

export interface Course {
  id: number
  course_id: string
  name_th: string
  name_en: string
  credits: number
  description: string
  prerequisite: string
  faculty: Faculty
  avg_rating: number
  review_count: number
}

export interface CourseListResponse {
  data: Course[]
  total: number
  page: number
  limit: number
}

export interface CourseInsightTag {
  tag: string
  count: number
  percentage: number
}

export interface CourseInsightGroup {
  key: string
  title: string
  base: number
  tags: CourseInsightTag[]
}

export interface CourseInsight {
  total_reviews: number
  min_reviews_for_stats: number
  groups: CourseInsightGroup[]
  badges: string[]
  warnings: string[]
}

export interface CreateCoursePayload {
  course_id: string
  name_th: string
  name_en: string
  credits: number
  faculty_id: number
  description: string
  prerequisite?: string
}
