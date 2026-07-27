// Copy for the rules page, kept as pure data so it is testable in isolation and
// the overlay stays presentational. Ranks match the engine's rank letters and
// what Hand.tsx renders on the cards (A K Q J, not R D V). Effects are verified
// against packages/core/src/engine/{cards,moves}.ts.
export type CardRule = { ranks: string[], effect: string }
export type SpecialMove = { title: string, text: string }

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

export const specialMoveList: SpecialMove[] = [
  { title: 'Entrée dans la maison', text: "Une bille rejoint sa maison en franchissant l'entrée du couloir vers l'avant (donc derrière la case de départ), sans dépasser le bout du couloir de la maison." },
  { title: 'Capture', text: "Atterrir sur une bille adverse la renvoie à son nid. Tu ne peux pas atterrir sur tes propres billes." },
  { title: 'Protection', text: "Une bille posée sur sa case de départ ne peut être ni dépassée, ni capturée, ni échangée, ni poussée." }
]
