import { useState } from 'react'
import type { PlayerKind } from '@tock/core'
import { DEFAULT_RING_SIZE, RING_SIZE_OPTIONS } from '@tock/core'
import { theme } from '../theme'

type SetupProps = { onStart: (kindList: PlayerKind[], ringSize: number) => void }

// Seats 1-3 are opponents; seat 0 is always human and has no toggle. Each
// opponent seat button cycles human -> bot -> inactive -> human on click, and
// its accessible name is always the literal visible text `seat ${seat}: ${kind}`
// (seat is 1-indexed to match the on-screen seat number) so tests can query it
// deterministically with getByRole('button', { name: 'seat 1: bot' }) or the
// looser /^seat 1:/ pattern to find the button regardless of its current kind.
const opponentSeatList = [1, 2, 3] as const

const defaultOpponentKindList: PlayerKind[] = ['bot', 'inactive', 'inactive']

const nextKind = (kind: PlayerKind): PlayerKind => {
  if (kind === 'human') return 'bot'
  if (kind === 'bot') return 'inactive'
  return 'human'
}

export const Setup = ({ onStart }: SetupProps) => {
  const [opponentKindList, setOpponentKindList] = useState<PlayerKind[]>(defaultOpponentKindList)
  const [ringSize, setRingSize] = useState<number>(DEFAULT_RING_SIZE)

  const handleToggle = (seatIndex: number) => {
    setOpponentKindList(previous => previous.map((kind, index) => (index === seatIndex ? nextKind(kind) : kind)))
  }

  const handleStart = () => {
    const kindList: PlayerKind[] = ['human', ...opponentKindList]
    onStart(kindList, ringSize)
  }

  return (
    <div style={{ color: theme.text, padding: 20, textAlign: 'center' }}>
      <h1>TOCK</h1>
      <p>Seats</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {opponentSeatList.map((seat, index) => {
          const kind = opponentKindList[index] ?? 'inactive'
          return (
            <button key={seat} onClick={() => handleToggle(index)}>
              {`seat ${seat}: ${kind}`}
            </button>
          )
        })}
      </div>
      <p>Board size</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {RING_SIZE_OPTIONS.map(size => (
          <button key={size} aria-pressed={ringSize === size} onClick={() => setRingSize(size)}>{size}</button>
        ))}
      </div>
      <button style={{ marginTop: 16 }} onClick={handleStart}>Start</button>
    </div>
  )
}
