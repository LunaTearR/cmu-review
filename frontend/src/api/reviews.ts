import { get, post } from './client'
import type { ReviewListResponse, CreateReviewPayload, Review } from '@/types/review'

export const fetchReviews = (courseId: number, page = 1, limit = 20): Promise<ReviewListResponse> =>
  get<ReviewListResponse>(`/courses/${courseId}/reviews?page=${page}&limit=${limit}`)

export const createReview = (courseId: number, payload: CreateReviewPayload): Promise<Review> =>
  post<Review>(`/courses/${courseId}/reviews`, payload)
