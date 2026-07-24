import { describe, expect, it } from 'vitest'
import type { Card, Move } from '@tock/core'
import type { HintContext } from '../src/hint'
import { hintFor } from '../src/hint'
import { useHint } from '../src/hooks/useHint'

const card = (rank: Card['rank']): Card => ({ rank, suit: 'clubs' })
const moveMove = (rank: Card['rank'], steps: number): Move => ({ type: 'move', card: card(rank), marbleId: 'p0m0', steps })
const exitMove = (rank: Card['rank']): Move => ({ type: 'exit', card: card(rank), marbleId: 'p0m0' })
const pushMove: Move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 }
const split7Single: Move = { type: 'split7', card: card('7'), partList: [{ marbleId: 'p0m0', steps: 7 }] }

describe('hintFor', () => {
  it('is empty when it is not the human turn', () => {
    expect(hintFor({ kind: 'idle' })).toBe('')
  })

  it('prompts a card pick and a stuck-hand discard', () => {
    expect(hintFor({ kind: 'pickCard' })).toBe('choisis une carte')
    expect(hintFor({ kind: 'onlyDiscards' })).toBe('aucun coup — touche une carte pour la défausser')
  })

  it('teaches the 5 (push) and the 4 (backward)', () => {
    expect(hintFor({ kind: 'ghosts', card: card('5'), moves: [pushMove] }))
      .toBe('avance un adversaire de 5 — choisis lequel')
    expect(hintFor({ kind: 'ghosts', card: card('4'), moves: [moveMove('4', -4)] }))
      .toBe('recule ta bille de 4 cases — choisis laquelle')
  })

  it('treats a single-marble 7 as a plain advance of 7', () => {
    expect(hintFor({ kind: 'ghosts', card: card('7'), moves: [split7Single] }))
      .toBe('avance ta bille de 7')
  })

  it('varies the Ace hint by whether exit and move are available', () => {
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [exitMove('A'), moveMove('A', 1)] }))
      .toBe("l'As sort une bille ou l'avance de 1")
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [exitMove('A')] }))
      .toBe("l'As fait sortir une bille")
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [moveMove('A', 1)] }))
      .toBe('avance ta bille de 1')
  })

  it('varies the King hint the same way', () => {
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [exitMove('K'), moveMove('K', 13)] }))
      .toBe("le Roi sort une bille ou l'avance de 13")
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [exitMove('K')] }))
      .toBe('le Roi fait sortir une bille')
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [moveMove('K', 13)] }))
      .toBe('avance ta bille de 13')
  })

  it('reads the step count from the move for a plain forward card (Queen = 12)', () => {
    expect(hintFor({ kind: 'ghosts', card: card('Q'), moves: [moveMove('Q', 12)] }))
      .toBe('avance ta bille de 12')
    expect(hintFor({ kind: 'ghosts', card: card('3'), moves: [moveMove('3', 3)] }))
      .toBe('avance ta bille de 3')
  })

  it('guides the Jack swap in two steps', () => {
    expect(hintFor({ kind: 'swapSource' })).toBe('échange 2 billes — choisis la tienne')
    expect(hintFor({ kind: 'swapTarget' })).toBe('choisis la bille adverse à échanger')
  })

  it('guides the 7-split progressively', () => {
    expect(hintFor({ kind: 'split', focused: false, remaining: 7 }))
      .toBe('le 7 se répartit — choisis une bille')
    expect(hintFor({ kind: 'split', focused: true, remaining: 7 }))
      .toBe("choisis jusqu'où avancer")
    expect(hintFor({ kind: 'split', focused: false, remaining: 4 }))
      .toBe('continue — répartis les 4 pas restants')
    expect(hintFor({ kind: 'split', focused: false, remaining: 1 }))
      .toBe('continue — répartis le pas restant')
    expect(hintFor({ kind: 'split', focused: false, remaining: 0 })).toBe('')
  })
})

describe('useHint', () => {
  it('returns exactly what hintFor returns', () => {
    const ctx: HintContext = { kind: 'pickCard' }
    expect(useHint(ctx)).toBe(hintFor(ctx))
  })
})
