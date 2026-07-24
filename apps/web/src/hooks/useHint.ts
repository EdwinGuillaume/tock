import type { HintContext } from '../hint'
import { hintFor } from '../hint'

// Thin hook wrapper: the wording logic lives in the pure hintFor, so it is unit-
// tested without React; the hook keeps GameScreen declarative.
export const useHint = (ctx: HintContext): string => hintFor(ctx)
