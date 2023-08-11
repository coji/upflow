import { useNavigation } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { Progress } from './ui'

export const AppLoadingProgress = () => {
  const navigation = useNavigation()
  const [value, setValue] = useState(0)

  useEffect(() => {
    let interval: number | null = null
    if (navigation.state === 'loading') {
      setValue(0)
      interval = window.setInterval(() => {
        // 演出
        setValue((v) => {
          if (v < 50) return v + Math.random() * 2
          if (v < 90) return v * v
          return v + 1
        })
      }, 100)
    } else {
      setValue(100)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [navigation.state])

  return (
    <Progress
      className={`fixed left-0 right-0 top-0 h-[2px] transition-opacity duration-1000 ${
        navigation.state === 'loading' ? 'opacity-100' : 'opacity-0'
      }`}
      value={value}
    />
  )
}
