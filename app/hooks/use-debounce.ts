import { useCallback, useEffect, useRef } from 'react'

type Debounce = (fn: () => void) => void

export const useDebounce = (timeout = 200): Debounce => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  const debounce: Debounce = useCallback(
    (fn) => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(() => {
        fn()
      }, timeout)
    },
    [timeout],
  )
  return debounce
}
