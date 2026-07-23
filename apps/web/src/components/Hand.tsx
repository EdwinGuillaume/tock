import type { Card, Suit } from '@tock/core'
import { theme } from '../theme'

type HandProps = {
  hand: Card[]
  playableList: boolean[]
  selectedIndex: number
  discardMode?: boolean
  onSelect: (index: number) => void
}

const suitGlyph: Record<Suit, string> = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' }
const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds'

export const Hand = ({ hand, playableList, selectedIndex, discardMode, onSelect }: HandProps) => {
  const mid = (hand.length - 1) / 2
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 130, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
      {hand.map((card, index) => {
        const playable = playableList[index] ?? false
        const selected = index === selectedIndex
        const angle = (index - mid) * 8
        const lift = selected ? -20 : Math.abs(index - mid) * 2
        const ink = isRed(card) ? theme.cardInkRed : theme.cardInk
        return (
          <button
            key={`${card.rank}-${card.suit}`}
            aria-label={`card-${card.rank}-${card.suit}`}
            disabled={!playable}
            onClick={() => onSelect(index)}
            className="tock-deal"
            style={{
              position: 'relative', width: 62, height: 86, margin: '0 -7px', borderRadius: theme.radius.card, border: 'none',
              background: theme.cardFace, color: ink, fontFamily: theme.fontDisplay, fontWeight: 700,
              transformOrigin: 'bottom center',
              transform: `rotate(${selected ? 0 : angle}deg) translateY(${lift}px) scale(${selected ? 1.07 : 1})`,
              opacity: playable && !discardMode ? 1 : 0.42, cursor: playable ? 'pointer' : 'default',
              boxShadow: selected ? `${theme.shadowFloat}, 0 0 0 2px ${theme.gold}, ${theme.glowGold}` : theme.shadowCard,
              transition: `transform 0.16s ${theme.ease.spring}, box-shadow 0.16s ease`, zIndex: selected ? 5 : 1
            }}
          >
            <span style={{ position: 'absolute', top: 6, left: 7, fontSize: 16, lineHeight: 0.85 }}>{card.rank}<br />{suitGlyph[card.suit]}</span>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>{suitGlyph[card.suit]}</span>
          </button>
        )
      })}
    </div>
  )
}
