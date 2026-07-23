import { AnimatePresence, motion } from 'motion/react'
import { duration, prefersReducedMotion } from '../motion'

type ScreenTransitionProps = { screenKey: string, cover?: boolean, children: React.ReactNode }

export const ScreenTransition = ({ screenKey, cover, children }: ScreenTransitionProps) => {
  const reduced = prefersReducedMotion()
  const fade = cover ? duration.fast : duration.base
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        initial={reduced ? false : { opacity: 0, scale: cover ? 1 : 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : fade, ease: [0.7, 0, 0.84, 0] }}
        style={{ height: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
