export interface Review {
  id: number
  rating: number
  grade: string
  academic_year: number
  semester: number
  content: string
  category?: string
  program?: string
  professor?: string
  reviewer_name?: string
  created_at: string
}

export interface ReviewListResponse {
  data: Review[]
  total: number
  page: number
  limit: number
}

export interface CreateReviewPayload {
  rating: number
  grade: string
  academic_year: number
  semester: number
  content: string
  category?: string
  program?: string
  professor?: string
  reviewer_name?: string
}
