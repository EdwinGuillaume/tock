import { theme } from '../theme'

type HintProps = { text: string }

// Discreet felt chip. Positioning is owned by the parent overlay column; this
// component only styles the pill and wraps long teaching lines.
export const Hint = ({ text }: HintProps) => {
  if (text === '') return null
  return (
    <div style={{ maxWidth: 300, textAlign: 'center', fontSize: 12, lineHeight: 1.35, color: 'rgba(232,234,240,.62)', background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: theme.radius.sm, padding: '4px 12px', pointerEvents: 'none' }}>{text}</div>
  )
}
