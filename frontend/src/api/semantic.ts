import { get } from './client'
import type { SemanticSearchResponse } from '@/types/semantic'

export const fetchSemanticSearch = (
  q: string,
  limit = 12,
  tags: string[] = [],
): Promise<SemanticSearchResponse> => {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (tags.length > 0) params.set('tags', tags.join(','))
  return get<SemanticSearchResponse>(`/courses/semantic-search?${params.toString()}`)
}
