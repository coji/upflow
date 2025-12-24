import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
  Stack,
} from '~/app/components/ui'

type Status = 'idle' | 'running' | 'completed' | 'error'

interface ProgressData {
  repo: string
  current: number
  total: number
}

export const Recalculate = () => {
  const { organization } = useParams()
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [message, setMessage] = useState<string>('')
  const eventSourceRef = useRef<EventSource | null>(null)

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const handleRecalculate = useCallback(() => {
    if (!organization) return

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setStatus('running')
    setProgress(null)
    setMessage('Starting...')

    const eventSource = new EventSource(
      `/api/admin/recalculate/${organization}`,
    )
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      let data: {
        type: string
        message?: string
        repo?: string
        current?: number
        total?: number
      }
      try {
        data = JSON.parse(event.data)
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
        setStatus('error')
        setMessage('Invalid server response')
        eventSource.close()
        eventSourceRef.current = null
        return
      }

      switch (data.type) {
        case 'start':
          setMessage(data.message ?? '')
          break
        case 'progress':
          setProgress({
            repo: data.repo ?? '',
            current: data.current ?? 0,
            total: data.total ?? 0,
          })
          setMessage(`Processing: ${data.repo ?? ''}`)
          break
        case 'upsert':
        case 'export':
          setMessage(data.message ?? '')
          break
        case 'complete':
          setStatus('completed')
          setMessage(data.message ?? '')
          eventSource.close()
          eventSourceRef.current = null
          break
        case 'error':
          setStatus('error')
          setMessage(data.message ?? 'Unknown error')
          eventSource.close()
          eventSourceRef.current = null
          break
      }
    }

    eventSource.onerror = () => {
      setStatus('error')
      setMessage('Connection error occurred')
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [organization])

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recalculate Cycle Times</CardTitle>
        <CardDescription>
          Recalculate pickup/review/deploy times based on current excluded users
          settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack>
          {status === 'running' && progress && (
            <div className="space-y-2">
              <Progress value={progressPercent} />
              <p className="text-muted-foreground text-sm">
                {progress.current}/{progress.total} repositories
              </p>
            </div>
          )}

          {message && status !== 'idle' && (
            <Alert variant={status === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </Stack>
      </CardContent>
      <CardFooter>
        <Button onClick={handleRecalculate} disabled={status === 'running'}>
          {status === 'running' ? 'Processing...' : 'Recalculate'}
        </Button>
      </CardFooter>
    </Card>
  )
}
