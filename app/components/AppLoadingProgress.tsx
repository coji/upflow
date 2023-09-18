import { useNavigation } from '@remix-run/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export const AppLoadingProgress = () => {
  const navigation = useNavigation()
  const isRemixLoading = navigation.state !== 'idle'
  const queryClient = useQueryClient()
  const isReactQueryLoading = !!queryClient.isFetching()
  const isLoading = isRemixLoading || isReactQueryLoading
  const [value, setValue] = useState(0)

  useEffect(() => {
    let interval: number | null = null
    if (isLoading) {
      setValue(0)
      interval = window.setInterval(() => {
        // 演出
        setValue((v) => {
          if (v < 50) return v + Math.random() * 2
          if (v < 90) return v + 1
          return v
        })
      }, 100)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
        setValue(100)
        setTimeout(() => {
          setValue(0)
        }, 500)
      }
    }
  }, [isLoading])

  return (
    <div className="relative h-1 w-full overflow-hidden rounded-none">
      <div
        className={`h-full w-full flex-1 bg-primary transition-all duration-500 ${
          !isLoading ? 'opacity-0' : 'opacity-100 '
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
