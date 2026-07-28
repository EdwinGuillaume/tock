import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Rank } from '@tock/core'
import { theme } from '../theme'
import { rankGlyph } from '../format'
import { duration, easeSpring, prefersReducedMotion } from '../motion'
import { safeBottom, safeTop } from '../layout'
import type { RuleNote } from '../rulesContent'
import { cardRuleList, generalRuleList, rulesGoal, specialMoveList } from '../rulesContent'

type RulesOverlayProps = { open: boolean, onClose: () => void }

const MiniCard = ({ rank }: { rank: Rank }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 34, borderRadius: 6, background: theme.cardFace, color: theme.cardInk, fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 13, boxShadow: theme.shadowCard, flex: 'none' }}>{rankGlyph[rank]}</span>
)

const sectionLabel = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: theme.goldDim, opacity: 0.85, margin: '22px 2px 12px' } as const

const NoteList = ({ noteList }: { noteList: RuleNote[] }) => (
  <>
    {noteList.map(note => (
      <div key={note.title} style={{ padding: '7px 2px' }}>
        <div style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 14.5, color: theme.gold }}>{note.title}</div>
        <div style={{ fontFamily: theme.fontUi, fontSize: 13.5, lineHeight: 1.4, color: theme.inkDim, marginTop: 2 }}>{note.text}</div>
      </div>
    ))}
  </>
)

export const RulesOverlay = ({ open, onClose }: RulesOverlayProps) => {
  const reduced = prefersReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="rules-backdrop"
          onClick={onClose}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : duration.fast }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,12,10,.66)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={event => event.stopPropagation()}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduced ? 0 : duration.base, ease: easeSpring }}
            style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', background: theme.feltPanel, color: theme.ink, boxShadow: theme.shadowFloat, paddingTop: safeTop(0), paddingBottom: safeBottom(0) }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: `1px solid ${theme.hairline}` }}>
              <h2 id="rules-title" style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 22, color: theme.gold, margin: 0 }}>Règles</h2>
              <button ref={closeRef} type="button" aria-label="Fermer les règles" onClick={onClose}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', flex: 'none', background: 'rgba(255,255,255,.08)', color: theme.ink, fontSize: 17 }}>✕</button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 22px' }}>
              <p style={{ fontFamily: theme.fontUi, fontSize: 15, lineHeight: 1.5, color: theme.ink, margin: '14px 2px 4px' }}>{rulesGoal}</p>

              <div style={sectionLabel}>Les cartes</div>
              {cardRuleList.map(rule => (
                <div key={rule.ranks.join('-')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px' }}>
                  <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                    {rule.ranks.map(rank => <MiniCard key={rank} rank={rank} />)}
                  </span>
                  <span style={{ fontFamily: theme.fontUi, fontSize: 13.5, lineHeight: 1.35, color: theme.ink }}>{rule.effect}</span>
                </div>
              ))}

              <div style={sectionLabel}>Coups spéciaux</div>
              <NoteList noteList={specialMoveList} />

              <div style={sectionLabel}>Bon à savoir</div>
              <NoteList noteList={generalRuleList} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
