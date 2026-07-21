import type { Card } from '@tock/core'
import { theme } from '../theme'

type HandProps = {
  hand: Card[]
  playableList: boolean[]
  selectedIndex: number
  onSelect: (index: number) => void
}

const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds'

export const Hand = ({ hand, playableList, selectedIndex, onSelect }: HandProps) => {
  const mid = (hand.length - 1) / 2
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 108,
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
    }}>
      {hand.map((card, index) => {
        const playable = playableList[index] ?? false
        const angle = (index - mid) * 8
        const lift = index === selectedIndex ? -16 : Math.abs(index - mid) * 2
        return (
          <button
            key={`${card.rank}-${card.suit}-${index}`}
            aria-label={`card-${card.rank}-${card.suit}`}
            disabled={!playable}
            onClick={() => onSelect(index)}
            style={{
              width: 56, height: 80, margin: '0 -6px', borderRadius: 8, border: 'none',
              background: theme.cardFace, color: isRed(card) ? theme.cardInkRed : theme.cardInk,
              fontWeight: 700, fontSize: 24, transformOrigin: 'bottom center',
              transform: `rotate(${angle}deg) translateY(${lift}px)`,
              opacity: playable ? 1 : 0.4, cursor: playable ? 'pointer' : 'default',
              boxShadow: '0 3px 6px rgba(0,0,0,.5)'
            }}
          >
            {card.rank}
          </button>
        )
      })}
    </div>
  )
}
