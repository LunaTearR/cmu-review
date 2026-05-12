import { get, post } from './client'
import type { Course, CourseListResponse, CreateCoursePayload } from '@/types/course'
import type { Faculty } from '@/types/faculty'

export interface CourseListParams {
  faculty?: string
  credits?: number
  category?: string
  program?: string
  sort?: string
  search?: string
  page?: number
  limit?: number
}

function toQuery(params: CourseListParams): string {
  const q = new URLSearchParams()
  if (params.faculty)           q.set('faculty', params.faculty)
  if (params.credits)           q.set('credits', String(params.credits))
  if (params.category)          q.set('category', params.category)
  if (params.program)           q.set('program', params.program)
  if (params.sort)              q.set('sort', params.sort)
  if (params.search)            q.set('search', params.search)
  if (params.page)              q.set('page', String(params.page))
  if (params.limit)             q.set('limit', String(params.limit))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const fetchFaculties = (): Promise<Faculty[]> =>
  get<{ data: Faculty[] }>('/faculties').then(r => r.data)

export const fetchPrograms = (): Promise<string[]> =>
  get<{ data: string[] }>('/programs').then(r => r.data)

export const fetchCourses = (params: CourseListParams = {}): Promise<CourseListResponse> =>
  get<CourseListResponse>(`/courses${toQuery(params)}`)

export const fetchCourse = (id: number): Promise<Course> =>
  get<Course>(`/courses/${id}`)

export const createCourse = (payload: CreateCoursePayload): Promise<Course> =>
  post<Course>('/courses', payload)
