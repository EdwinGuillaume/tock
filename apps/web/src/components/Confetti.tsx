import { useMemo } from 'react'
import { seatColor } from '../theme'

// A fixed set of falling pieces. Positions/timings are derived from the index
// (no Math.random) so the render is deterministic and SSR/test-safe.
export const Confetti = () => {
  const pieceList = useMemo(() => {
    const palette = ['#ffd873', seatColor.red.light, seatColor.green.light, seatColor.blue.light, seatColor.purple.light]
    return Array.from({ length: 26 }, (_unused, index) => ({
      left: (index * 37) % 100,
      color: palette[index % palette.length] ?? '#ffd873',
      duration: 2.4 + (index % 5) * 0.4,
      delay: (index % 7) * 0.4
    }))
  }, [])
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieceList.map((piece, index) => (
        <span key={index} className="tock-confetti" style={{ position: 'absolute', top: -14, left: `${piece.left}%`, width: 8, height: 12, borderRadius: 2, background: piece.color, animationDuration: `${piece.duration}s`, animationDelay: `${piece.delay}s`, animationIterationCount: 'infinite', animationTimingFunction: 'linear' }} />
      ))}
    </div>
  )
}
