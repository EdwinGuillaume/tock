import type { Card, Rank, Suit } from './types'

export const rankList: Rank[] =
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const suitList: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export const moveSteps = (rank: Rank): number | null => {
  switch (rank) {
    case 'A': return 1
    case 'K': return 13
    case 'Q': return 12
    case '4': return -4
    case 'J': return null
    case '7': return null
    case '5': return null // the 5 pushes an opponent; it has no self-move value
    default: return Number(rank)
  }
}

export const canExit = (rank: Rank): boolean => rank === 'A' || rank === 'K'

export const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (const suit of suitList) {
    for (const rank of rankList) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

// Fisher-Yates by removal: pick a random remaining element each round. Avoids
// index-swap temporaries (and the non-null assertions they would need).
export const shuffle = <Item>(list: Item[], random: () => number = Math.random): Item[] => {
  const source = [...list]
  const result: Item[] = []
  while (source.length > 0) {
    const index = Math.floor(random() * source.length)
    const [picked] = source.splice(index, 1)
    if (picked !== undefined) result.push(picked)
  }
  return result
}
