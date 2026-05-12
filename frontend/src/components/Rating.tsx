import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaw } from '@fortawesome/free-solid-svg-icons'

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
              <FontAwesomeIcon icon={faPaw} />
            ) : half ? (
              <span className="paw-half">
                <FontAwesomeIcon icon={faPaw} className="paw-base" />
                <span className="paw-clip">
                  <FontAwesomeIcon icon={faPaw} />
                </span>
              </span>
            ) : (
              <FontAwesomeIcon icon={faPaw} />
            )}
          </span>
        )
      })}
    </div>
  )
}
