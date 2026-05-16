import type { Course } from './course'

export interface SemanticHit {
  course: Course
  score: number
  matched_count: number
  top_review_text: string
}

export interface SemanticSearchResponse {
  query: string
  data: SemanticHit[]
}
