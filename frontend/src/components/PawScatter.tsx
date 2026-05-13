import { useMemo } from 'react'

interface PawScatterProps {
  count?: number
  seed?: number
  sizeMin?: number
  sizeMax?: number
  /** Reference container width in px — used only for overlap math (default 1200) */
  refWidth?: number
  /** Reference container height in px — used only for overlap math (default 600) */
  refHeight?: number
  /** Multiplier for min center-distance vs combined size. <0.5 allows kiss, >0.5 forces gap. */
  spacing?: number
  className?: string
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Paw {
  top: number
  left: number
  size: number
  rotate: number
  opacity: number
}

export function PawScatter({
  count = 2,
  seed = 1,
  sizeMin = 380,
  sizeMax = 620,
  refWidth = 1200,
  refHeight = 600,
  spacing = 0.55,
  className = '',
}: PawScatterProps) {
  const paws = useMemo<Paw[]>(() => {
    const rand = mulberry32(seed)
    const range = sizeMax - sizeMin
    const placed: Paw[] = []
    const MAX_TRIES = 60

    const collides = (a: Paw, b: Paw) => {
      const dx = ((a.left - b.left) / 100) * refWidth
      const dy = ((a.top - b.top) / 100) * refHeight
      return Math.hypot(dx, dy) < (a.size + b.size) * spacing
    }

    for (let i = 0; i < count; i++) {
      let candidate: Paw | null = null
      for (let t = 0; t < MAX_TRIES; t++) {
        const c: Paw = {
          top: 10 + rand() * 80,
          left: 8 + rand() * 84,
          size: sizeMin + rand() * range,
          rotate: rand() * 360,
          opacity: 0.03 + rand() * 0.035,
        }
        if (!placed.some(p => collides(c, p))) {
          candidate = c
          break
        }
        candidate = c // keep last as fallback
      }
      if (candidate) placed.push(candidate)
    }
    return placed
  }, [count, seed, sizeMin, sizeMax, refWidth, refHeight, spacing])

  return (
    <div className={`paw-scatter ${className}`} aria-hidden>
      {paws.map((p, i) => (
        <span
          key={i}
          className="paw"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  )
}
