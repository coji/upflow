import { useCallback, useState } from 'react'
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

  const handleRecalculate = useCallback(() => {
    if (!organization) return

    setStatus('running')
    setProgress(null)
    setMessage('Starting...')

    const eventSource = new EventSource(
      `/api/admin/recalculate/${organization}`,
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'start':
          setMessage(data.message)
          break
        case 'progress':
          setProgress({
            repo: data.repo,
            current: data.current,
            total: data.total,
          })
          setMessage(`Processing: ${data.repo}`)
          break
        case 'upsert':
        case 'export':
          setMessage(data.message)
          break
        case 'complete':
          setStatus('completed')
          setMessage(data.message)
          eventSource.close()
          break
        case 'error':
          setStatus('error')
          setMessage(data.message)
          eventSource.close()
          break
      }
    }

    eventSource.onerror = () => {
      setStatus('error')
      setMessage('Connection error occurred')
      eventSource.close()
    }
  }, [organization])

  const progressPercent = progress
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
