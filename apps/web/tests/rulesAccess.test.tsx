import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Home } from '../src/components/Home'
import { Setup } from '../src/components/Setup'
import { StatusBar } from '../src/components/StatusBar'

describe('rules access points', () => {
  it('Home opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<Home onPlay={() => {}} onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })

  it('Setup opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<Setup onStart={() => {}} onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })

  it('the in-game StatusBar opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<StatusBar turnColor="red" drawCount={4} discardCount={2} prompt="À toi de jouer" onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })
})
