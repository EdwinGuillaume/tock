import { useEffect, useRef } from 'react'
import { theme } from '../theme'

type GameLogProps = { logList: string[] }

// 8-line tall, touch-scrollable, top-faded. Auto-scrolls to the bottom whenever a
// new line is appended (design spec §6.2).
export const GameLog = ({ logList }: GameLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [logList.length])

  return (
    <div
      ref={scrollRef}
      data-testid="game-log"
      style={{
        height: 130, overflowY: 'auto', padding: '0 8px', fontSize: 12, lineHeight: '16.5px',
        color: theme.textDim, WebkitOverflowScrolling: 'touch',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)'
      }}
    >
      {logList.map((line, index) => (
        <div key={index} style={{ color: index === logList.length - 1 ? theme.text : undefined }}>{line}</div>
      ))}
    </div>
  )
}
