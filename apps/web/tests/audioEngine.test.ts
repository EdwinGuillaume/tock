import { describe, expect, it } from 'vitest'
import { sourcesFor } from '../src/audio/AudioEngine'

describe('sourcesFor', () => {
  it('builds an mp3 source list under the given root', () => {
    expect(sourcesFor('move-1', '/tock/audio')).toEqual(['/tock/audio/move-1.mp3'])
  })
})
