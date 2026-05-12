import { createContext, useCallback, useContext, useState } from 'react'

type Key = 'courses' | 'reviews'

interface Ctx {
  coursesV: number
  reviewsV: number
  bump: (k: Key) => void
}

const DataRefreshCtx = createContext<Ctx | null>(null)

export function useDataRefresh(): Ctx {
  const ctx = useContext(DataRefreshCtx)
  if (!ctx) throw new Error('useDataRefresh must be inside DataRefreshProvider')
  return ctx
}

export function DataRefreshProvider({ children }: { children: React.ReactNode }) {
  const [coursesV, setCoursesV] = useState(0)
  const [reviewsV, setReviewsV] = useState(0)
  const bump = useCallback((k: Key) => {
    if (k === 'courses') setCoursesV(v => v + 1)
    if (k === 'reviews') setReviewsV(v => v + 1)
  }, [])
  return (
    <DataRefreshCtx.Provider value={{ coursesV, reviewsV, bump }}>
      {children}
    </DataRefreshCtx.Provider>
  )
}
