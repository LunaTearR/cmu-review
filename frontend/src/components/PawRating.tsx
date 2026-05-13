import { useState } from 'react'

interface PawRatingProps {
  /** 0–max rating, supports 0.25 increments */
  value: number
  size?: number
  /** total paws (default 5) */
  max?: number
  /** when provided, component becomes interactive */
  onChange?: (v: number) => void
}

function fingersForFrac(frac: number): number {
  if (frac <= 0)    return 0
  if (frac <= 0.25) return 1
  if (frac <= 0.50) return 2
  if (frac <= 0.75) return 3
  return 4
}

// Font Awesome `paw` (Solid, free). Split into 4 toes + 1 pad so each can color independently.
const TOE_FAR_LEFT    = "M100.4 198.6c18.9 32.4 14.3 70.1-10.2 84.1s-59.7-1-78.5-33.4S-2.7 179.2 21.8 165.2s59.7 1 78.5 33.4z"
const TOE_UPPER_LEFT  = "M226.5 92.9c14.3 42.9-.3 86.2-32.6 96.8s-70.1-15.6-84.4-58.5.3-86.2 32.6-96.8 70.1 15.6 84.4 58.5z"
const TOE_UPPER_RIGHT = "M310.1 189.7c-32.3-10.6-46.9-53.9-32.6-96.8s52.1-69.1 84.4-58.5 46.9 53.9 32.6 96.8-52.1 69.1-84.4 58.5z"
const TOE_FAR_RIGHT   = "M421.8 282.7c-24.5-14-29.1-51.7-10.2-84.1s54-47.4 78.5-33.4 29.1 51.7 10.2 84.1-54 47.4-78.5 33.4z"
const PAD             = "M69.2 401.2C121.6 259.9 214.7 224 256 224s134.4 35.9 186.8 177.2c3.6 9.7 5.2 20.1 5.2 30.5v1.6c0 25.8-20.9 46.7-46.7 46.7-11.5 0-22.9-1.4-34-4.2l-88-22c-15.3-3.8-31.3-3.8-46.6 0l-88 22c-11.1 2.8-22.5 4.2-34 4.2C84.9 480 64 459.1 64 433.3v-1.6c0-10.4 1.6-20.8 5.2-30.5z"

function PawIcon({ fingers, padOn, size }: { fingers: number; padOn: boolean; size: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className="paw-rating" aria-hidden>
      <path d={TOE_FAR_LEFT}    className={`pr-toe ${fingers >= 1 ? 'is-on' : ''}`} />
      <path d={TOE_UPPER_LEFT}  className={`pr-toe ${fingers >= 2 ? 'is-on' : ''}`} />
      <path d={TOE_UPPER_RIGHT} className={`pr-toe ${fingers >= 3 ? 'is-on' : ''}`} />
      <path d={TOE_FAR_RIGHT}   className={`pr-toe ${fingers >= 4 ? 'is-on' : ''}`} />
      <path d={PAD}             className={`pr-pad ${padOn ? 'is-on' : ''}`} />
    </svg>
  )
}

/**
 * Row of `max` FA-paws. Whole rating-point = 1 full paw.
 * Fractional part of last partial paw → fingers via 0.25 buckets:
 *   (0, 0.25] → 1   (0.25, 0.50] → 2   (0.50, 0.75] → 3   (0.75, 1.0) → 4
 * Pass `onChange` for interactive (whole-paw click selects integer 1–max).
 */
export function PawRating({ value, size = 18, max = 5, onChange }: PawRatingProps) {
  const interactive = !!onChange
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  return (
    <div
      className={`paw-rating-row ${interactive ? 'is-input' : ''}`}
      role={interactive ? 'slider' : 'img'}
      aria-label={`คะแนน ${display.toFixed(1)} จาก ${max}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? max : undefined}
      aria-valuenow={interactive ? display : undefined}
      onMouseLeave={() => interactive && setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        let fingers = 0
        if (display >= i + 1) {
          fingers = 4
        } else if (display > i) {
          fingers = fingersForFrac(display - i)
        }
        const padOn = fingers >= 1
        const icon = <PawIcon fingers={fingers} padOn={padOn} size={size} />

        if (!interactive) return <span key={i}>{icon}</span>

        return (
          <span
            key={i}
            className="pr-slot"
            onMouseEnter={() => setHover(i + 1)}
            onClick={() => onChange?.(i + 1)}
          >
            {icon}
          </span>
        )
      })}
    </div>
  )
}
