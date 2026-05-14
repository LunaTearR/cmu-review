import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Review } from '@/types/review'
import { ReviewModalForm } from '@/components/ReviewModalForm'
import { IconClose } from '@/components/Icons'
import { confirmDiscard } from '@/lib/confirm'
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
  const dirtyRef = useRef(false)

  const open = useCallback((opts?: OpenOpts) => {
    dirtyRef.current = false
    setState({ open: true, courseId: opts?.courseId, onSuccess: opts?.onSuccess })
  }, [])

  const forceClose = useCallback(() => {
    dirtyRef.current = false
    setState({ open: false })
  }, [])

  const requestClose = useCallback(async () => {
    if (dirtyRef.current) {
      const ok = await confirmDiscard()
      if (!ok) return
    }
    forceClose()
  }, [forceClose])

  const handleSuccess = useCallback((review: Review, courseId: number) => {
    state.onSuccess?.(review, courseId)
    bump('reviews')
    bump('courses')
    forceClose()
  }, [state.onSuccess, bump, forceClose])

  useEffect(() => {
    if (!state.open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [state.open])

  return (
    <ReviewModalCtx.Provider value={{ open, close: forceClose }}>
      {children}
      {state.open && createPortal(
        <div className="modal-backdrop">
          <div className="modal-shell" role="dialog" aria-modal="true" style={{ padding: '32px 36px 36px' }}>
            <button className="modal-close" onClick={requestClose} aria-label="ปิด">
              <IconClose />
            </button>
            <ReviewModalForm
              preselectCourseId={state.courseId}
              onSuccess={handleSuccess}
              onCancel={requestClose}
              onDirtyChange={(d) => { dirtyRef.current = d }}
            />
          </div>
        </div>,
        document.body,
      )}
    </ReviewModalCtx.Provider>
  )
}
