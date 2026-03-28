import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const COLORS = [
  { bg: '#FFF9F0', accent: '#C29B47', ring: '#E4C989' },
  { bg: '#FFF9F0', accent: '#C29B47', ring: '#E4C989' },
  { bg: '#FFF9F0', accent: '#C29B47', ring: '#E4C989' },
  { bg: '#FFF9F0', accent: '#C29B47', ring: '#E4C989' },
]

const ORBS = [
  { size: 220, top: '10%', left: '8%', delay: 0 },
  { size: 180, top: '18%', right: '10%', delay: 0.2 },
  { size: 260, bottom: '8%', left: '16%', delay: 0.1 },
  { size: 140, bottom: '16%', right: '18%', delay: 0.3 },
]

const LETTERS_LINE1 = 'Welcome to'.split('')
const LETTERS_LINE2 = 'Atlas Homestays'.split('')
const GOLD_A = '#D4AF37'

export default function IntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState('enter')
  const [portalScale, setPortalScale] = useState(100)

  const col = COLORS[0]
  const isExit = phase === 'exit'

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setPhase('hold'), 1500)
    const holdTimer = window.setTimeout(() => setPhase('exit'), 3200)
    const doneTimer = window.setTimeout(() => {
      setPhase('done')
      onComplete?.()
    }, 4400)

    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(holdTimer)
      window.clearTimeout(doneTimer)
    }
  }, [onComplete])

  useEffect(() => {
    const updateScale = () => {
      const diagonal = Math.hypot(window.innerWidth, window.innerHeight)
      setPortalScale(Math.max(100, diagonal / 12))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const ringSizes = useMemo(() => [260, 420, 600], [])

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden"
          style={{ background: '#fff9f0' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{
            opacity: 0,
            filter: 'blur(20px)',
            scale: 1,
            transition: { duration: 0.35, ease: 'easeOut' },
          }}
        >
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(38% 38% at 22% 18%, rgba(243,194,215,0.35) 0%, rgba(243,194,215,0) 60%), radial-gradient(45% 45% at 22% 78%, rgba(247,226,163,0.42) 0%, rgba(247,226,163,0) 62%), radial-gradient(40% 40% at 78% 32%, rgba(207,214,248,0.36) 0%, rgba(207,214,248,0) 60%), radial-gradient(42% 42% at 70% 78%, rgba(166,221,255,0.32) 0%, rgba(166,221,255,0) 60%), radial-gradient(50% 50% at 50% 40%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%)',
            }}
            animate={{ opacity: isExit ? 0 : 1, scale: isExit ? 1.04 : 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
          {ORBS.map((orb, i) => (
            <motion.div
              key={`orb-${i}`}
              className="absolute rounded-full"
              style={{
                width: orb.size,
                height: orb.size,
                top: orb.top,
                left: orb.left,
                right: orb.right,
                bottom: orb.bottom,
                background: `${col.accent}1f`,
                filter: 'blur(28px)',
              }}
              animate={
                isExit
                  ? { opacity: 0, scale: 0.55 }
                  : { opacity: [0.22, 0.48, 0.22], scale: [1, 1.05, 1] }
              }
              transition={
                isExit
                  ? { duration: 0.32, delay: 0, ease: 'easeOut' }
                  : { duration: 4.2, repeat: Infinity, delay: orb.delay, ease: 'easeInOut' }
              }
            />
          ))}

          {ringSizes.map((size, i) => (
            <motion.div
              key={`ring-${size}`}
              className="absolute rounded-full border"
              style={{
                width: size,
                height: size,
                borderColor: `${col.ring}33`,
              }}
              animate={
                isExit
                  ? { opacity: 0, scale: 0.35 }
                  : { opacity: [0.12, 0.26, 0.12], scale: [1, 1.02, 1] }
              }
              transition={
                isExit
                  ? { duration: 0.3, delay: i * 0.015, ease: 'easeOut' }
                  : { duration: 3.4, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }
              }
            />
          ))}

          <div className="relative z-10 text-center px-6 select-none">
            <div className="overflow-hidden">
              {LETTERS_LINE1.map((ch, i) => (
                <motion.span
                  key={`l1-${i}-${ch}`}
              className="inline-block text-lg md:text-2xl tracking-[0.22em] uppercase"
              style={{ color: '#b59a63' }}
              initial={{ y: 16, opacity: 0 }}
              animate={
                isExit
                  ? { opacity: 0, scale: 0.45 }
                  : { y: 0, opacity: 1, scale: 1 }
              }
              transition={
                isExit
                  ? { duration: 0.32, delay: i * 0.012, ease: 'easeOut' }
                  : { duration: 0.9, delay: i * 0.03, ease: [0.25, 0.85, 0.3, 1] }
              }
            >
              {ch === ' ' ? '\u00A0' : ch}
            </motion.span>
          ))}
            </div>

            <div className="mt-3 md:mt-4 text-4xl md:text-7xl font-semibold tracking-[0.08em]">
              {LETTERS_LINE2.map((ch, i) => {
                const isA = ch === 'A' && i === 0
                return (
                  <motion.span
                    key={`l2-${i}-${ch}`}
                  className="inline-block align-middle"
                  style={{
                    color: isA ? GOLD_A : '#2a2a2a',
                      textShadow: isA
                        ? '0 0 40px #D4AF3799, 0 0 80px #D4AF3755'
                        : '0 6px 18px rgba(0,0,0,0.18)',
                      transformOrigin: '50% 50%',
                      position: 'relative',
                      zIndex: isA ? 30 : 10,
                    }}
                    initial={{ y: 52, opacity: 0 }}
                    animate={
                      isA
                        ? isExit
                          ? {
                              y: 0,
                              x: 0,
                              scale: portalScale,
                              opacity: 1,
                              textShadow: '0 0 40px #D4AF3799, 0 0 80px #D4AF3755',
                            }
                          : { y: 0, x: 0, scale: 1, opacity: 1 }
                        : isExit
                          ? { y: 0, opacity: 0, scale: 0.38 }
                          : { y: 0, opacity: 1, scale: 1 }
                    }
                    transition={
                      isA
                        ? isExit
                          ? { duration: 1.05, ease: [0.35, 0.05, 0.25, 1], delay: 0 }
                          : { duration: 1.0, delay: i * 0.028, ease: [0.23, 0.95, 0.25, 1] }
                        : isExit
                          ? { duration: 0.34, delay: i * 0.012, ease: 'easeOut' }
                          : { duration: 1.0, delay: i * 0.028, ease: [0.23, 0.95, 0.25, 1] }
                    }
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </motion.span>
                )
              })}
            </div>

            <motion.p
              className="mt-5 text-xs md:text-sm tracking-[0.3em] uppercase"
              style={{ color: `${col.accent}` }}
              initial={{ opacity: 0, y: 8 }}
              animate={
                isExit
                  ? { opacity: 0, y: -4, scale: 0.5 }
                  : { opacity: 0.95, y: 0, scale: 1 }
              }
              transition={
                isExit
                  ? { duration: 0.3, delay: 0.05, ease: 'easeOut' }
                  : { duration: 0.8, delay: 0.9, ease: [0.22, 0.9, 0.2, 1] }
              }
            >
              Premium Homestay
            </motion.p>

            <motion.div
              className="mt-6 flex justify-center"
              style={{ height: 10 }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={isExit ? { opacity: 0, scaleX: 0.4 } : { opacity: 1, scaleX: 1 }}
              transition={isExit ? { duration: 0.3, ease: 'easeOut' } : { duration: 0.6 }}
            >
              <div className="h-[2px] w-12 rounded-full" style={{ background: col.accent }} />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
