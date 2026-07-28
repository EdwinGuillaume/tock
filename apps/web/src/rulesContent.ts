import type { Rank } from '@tock/core'

// Copy for the rules page, kept as pure data so it is testable in isolation and
// the overlay stays presentational. Ranks are the engine's rank letters
// (A/J/Q/K); the overlay maps them to their French glyph (V/D/R) at display time
// via `rankGlyph`, exactly like Hand.tsx does on the card faces. Effects are
// verified against packages/core/src/engine/{cards,moves}.ts.
export type CardRule = { ranks: Rank[], effect: string }
// A titled prose entry — shared by the special moves and the general rules.
export type RuleNote = { title: string, text: string }

export const rulesGoal = 'Ramène tes quatre billes dans ta maison avant les autres.'

export const cardRuleList: CardRule[] = [
  { ranks: ['A'], effect: 'sortir une bille ou avancer de 1' },
  { ranks: ['K'], effect: 'sortir une bille ou avancer de 13' },
  { ranks: ['Q'], effect: 'avancer de 12' },
  { ranks: ['J'], effect: 'échanger une de tes billes avec une adverse' },
  { ranks: ['7'], effect: 'répartir 7 cases de déplacement entre tes billes' },
  { ranks: ['5'], effect: 'avancer une bille adverse de 5' },
  { ranks: ['4'], effect: 'reculer de 4, jamais dans la maison' },
  { ranks: ['2', '3', '6', '8', '9', '10'], effect: 'avancer du nombre indiqué' }
]

export const specialMoveList: RuleNote[] = [
  { title: 'Entrée dans la maison', text: "Une bille rejoint sa maison en franchissant l'entrée du couloir vers l'avant (donc derrière la case de départ), sans dépasser le bout du couloir de la maison." },
  { title: 'Capture', text: "Atterrir sur une bille adverse la renvoie à son nid. Tu ne peux pas atterrir sur tes propres billes." },
  { title: 'Protection', text: "Une bille posée sur sa case de départ ne peut être ni dépassée, ni capturée, ni échangée, ni poussée." }
]

// Rules the game already enforces but never spells out on screen.
export const generalRuleList: RuleNote[] = [
  { title: 'Obligation de jouer', text: "On ne passe jamais son tour : si un coup est possible, tu dois le jouer, même s'il te désavantage. Ce n'est que sans aucun coup possible que tu défausses une carte." },
  { title: 'Dans la maison', text: 'Une fois dans la maison, tes billes ne peuvent plus se dépasser, mais tu peux toujours les avancer dans le couloir.' }
]
