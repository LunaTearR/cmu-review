import { useState } from 'react'
import { IconHeart, IconHeartOutline } from './Icons'

interface Props {
  value: number
  max?: number
  size?: 'md' | 'lg'
  onChange?: (v: number) => void
}

export function Rating({ value, max = 5, size = 'md', onChange }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const interactive = !!onChange
  const display = hover ?? value

  return (
    <div
      className={`heart-rating ${interactive ? 'is-input' : ''} ${size === 'lg' ? 'is-lg' : ''}`}
      onMouseLeave={() => interactive && setHover(null)}
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(display)
        const half = !filled && i < display && display - i >= 0.5
        return (
          <span
            key={i}
            className={`heart ${filled ? 'is-filled' : ''} ${half ? 'is-half' : ''}`}
            onMouseEnter={() => interactive && setHover(i + 1)}
            onClick={() => interactive && onChange?.(i + 1)}
          >
            {filled ? (
              <IconHeart width="100%" height="100%" />
            ) : half ? (
              <svg viewBox="0 0 24 24" width="100%" height="100%">
                <defs>
                  <linearGradient id={`hg-${i}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="var(--border-strong)" />
                  </linearGradient>
                </defs>
                <path fill={`url(#hg-${i})`} d="M12 21s-7.5-4.6-9.7-9.4C.7 7.7 3 3.5 7 3.5c2 0 3.7 1.2 5 3 1.3-1.8 3-3 5-3 4 0 6.3 4.2 4.7 8.1C19.5 16.4 12 21 12 21z" />
              </svg>
            ) : (
              <IconHeartOutline width="100%" height="100%" />
            )}
          </span>
        )
      })}
    </div>
  )
}
