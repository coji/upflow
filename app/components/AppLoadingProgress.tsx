import { useEffect, useRef, useState } from 'react'
import { useNavigation } from 'react-router'
import { cn } from '~/app/libs/utils'

/**
 * Compute next progress value with asymptotic easing:
 * fast start → gradual slowdown → stall near 90%.
 */
function nextProgress(current: number): number {
  if (current < 30) return current + Math.random() * 4 + 2
  if (current < 60) return current + Math.random() * 2 + 0.5
  if (current < 85) return current + Math.random() * 0.5
  return current // stall — wait for completion
}

/** Skip showing the bar for navigations faster than this threshold */
const SHOW_DELAY_MS = 150

type Phase = 'idle' | 'waiting' | 'loading' | 'completing'

/**
 * Manages the trickle progress lifecycle:
 * idle → waiting (delay) → loading (trickle toward ~85%) → completing (snap to 100%, fade out) → idle
 * If navigation finishes during waiting, the bar is never shown.
 */
function useLoadingProgress() {
  const navigation = useNavigation()
  const isNavigating = navigation.state !== 'idle'

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const phaseRef = useRef<Phase>('idle')
  const delayRef = useRef<number>(0)
  const intervalRef = useRef<number>(0)
  const fadeRef = useRef<number>(0)

  useEffect(() => {
    if (isNavigating) {
      // Cancel any in-flight fade-out from a previous navigation
      window.clearTimeout(fadeRef.current)

      // Enter waiting phase — delay before showing the bar
      phaseRef.current = 'waiting'
      setPhase('waiting')
      setProgress(0)

      delayRef.current = window.setTimeout(() => {
        if (phaseRef.current !== 'waiting') return
        // Promote to loading — start trickle
        phaseRef.current = 'loading'
        setPhase('loading')
        intervalRef.current = window.setInterval(() => {
          setProgress((v) => nextProgress(v))
        }, 150)
      }, SHOW_DELAY_MS)
    } else if (
      phaseRef.current === 'waiting' ||
      phaseRef.current === 'loading'
    ) {
      // Navigation finished
      window.clearTimeout(delayRef.current)
      window.clearInterval(intervalRef.current)

      if (phaseRef.current === 'waiting') {
        // Fast navigation — never show the bar
        phaseRef.current = 'idle'
        setPhase('idle')
      } else {
        // Was visible — snap to 100% and fade out
        phaseRef.current = 'completing'
        setPhase('completing')
        setProgress(100)
        fadeRef.current = window.setTimeout(() => {
          phaseRef.current = 'idle'
          setPhase('idle')
          setProgress(0)
        }, 400)
      }
    }

    return () => {
      window.clearTimeout(delayRef.current)
      window.clearInterval(intervalRef.current)
      window.clearTimeout(fadeRef.current)
    }
  }, [isNavigating])

  return { phase, progress }
}

export const AppLoadingProgress = () => {
  const { phase, progress } = useLoadingProgress()

  if (phase === 'idle' || phase === 'waiting') return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div
        className={cn(
          'h-full transition-all ease-out',
          phase === 'completing'
            ? 'opacity-0 duration-400'
            : 'opacity-100 duration-200',
        )}
        style={{ width: `${progress}%` }}
      >
        {/* Bar with shimmer effect */}
        <div className="relative h-full w-full bg-blue-500">
          <div className="absolute inset-0 animate-pulse bg-white/30" />
        </div>
      </div>
    </div>
  )
}
