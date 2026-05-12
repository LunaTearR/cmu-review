import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Review } from '@/types/review'
import { ReviewModalForm } from '@/components/ReviewModalForm'
import { IconClose } from '@/components/Icons'
import { useDataRefresh } from './DataRefreshContext'

interface OpenOpts {
  courseId?: number
  onSuccess?: (review: Review, courseId: number) => void
}

interface Ctx {
  open: (opts?: OpenOpts) => void
  close: () => void
}

const ReviewModalCtx = createContext<Ctx | null>(null)

export function useReviewModal(): Ctx {
  const ctx = useContext(ReviewModalCtx)
  if (!ctx) throw new Error('useReviewModal must be inside ReviewModalProvider')
  return ctx
}

interface State {
  open: boolean
  courseId?: number
  onSuccess?: (review: Review, courseId: number) => void
}

export function ReviewModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ open: false })
  const { bump } = useDataRefresh()

  const open = useCallback((opts?: OpenOpts) => {
    setState({ open: true, courseId: opts?.courseId, onSuccess: opts?.onSuccess })
  }, [])
  const close = useCallback(() => setState({ open: false }), [])

  const handleSuccess = useCallback((review: Review, courseId: number) => {
    state.onSuccess?.(review, courseId)
    bump('reviews')
    bump('courses')
    setState({ open: false })
  }, [state.onSuccess, bump])

  useEffect(() => {
    if (!state.open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [state.open, close])

  return (
    <ReviewModalCtx.Provider value={{ open, close }}>
      {children}
      {state.open && createPortal(
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="modal-shell" role="dialog" aria-modal="true" style={{ padding: '32px 36px 36px' }}>
            <button className="modal-close" onClick={close} aria-label="ปิด">
              <IconClose />
            </button>
            <ReviewModalForm
              preselectCourseId={state.courseId}
              onSuccess={handleSuccess}
              onCancel={close}
            />
          </div>
        </div>,
        document.body,
      )}
    </ReviewModalCtx.Provider>
  )
}
