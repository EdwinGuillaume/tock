import { theme } from '../theme'

type RulesButtonProps = { onClick: () => void, variant?: 'icon' | 'text' }

const iconStyle = {
  width: 22, height: 22, borderRadius: '50%', flex: 'none',
  border: `1px solid rgba(255,216,115,.35)`, background: 'rgba(0,0,0,.25)',
  color: theme.gold, fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 15,
  lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
} as const

const textStyle = {
  border: `1px solid rgba(255,216,115,.3)`, background: 'transparent',
  color: theme.goldDim, fontFamily: theme.fontUi, fontSize: 13, fontWeight: 600,
  borderRadius: theme.radius.pill, padding: '8px 18px', cursor: 'pointer'
} as const

export const RulesButton = ({ onClick, variant = 'icon' }: RulesButtonProps) => (
  <button type="button" aria-label="Ouvrir les règles" onClick={onClick} style={variant === 'text' ? textStyle : iconStyle}>
    {variant === 'text' ? 'Règles' : '?'}
  </button>
)
