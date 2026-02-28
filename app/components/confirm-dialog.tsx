import { useEffect, useRef } from 'react'
import { Form, useNavigation, type FetcherWithComponents } from 'react-router'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/app/components/ui/alert-dialog'
import { Button } from '~/app/components/ui/button'

interface ConfirmDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  desc: React.JSX.Element | string
  cancelBtnText?: string
  confirmText?: React.ReactNode
  destructive?: boolean
  fetcher?: FetcherWithComponents<T>
  action?: string
  children?: React.ReactNode
}

export function ConfirmDialog<T>(props: ConfirmDialogProps<T>) {
  const {
    title,
    desc,
    children,
    confirmText,
    cancelBtnText,
    destructive,
    fetcher,
    action,
    ...actions
  } = props
  const navigation = useNavigation()
  const didSubmitRef = useRef(false)

  useEffect(() => {
    if (fetcher?.state === 'submitting') {
      didSubmitRef.current = true
    }
  }, [fetcher?.state])

  useEffect(() => {
    if (didSubmitRef.current && fetcher?.state === 'idle') {
      const responseData = fetcher.data as Record<string, unknown> | undefined
      if (responseData && !('error' in responseData)) {
        actions.onOpenChange(false)
      }
      didSubmitRef.current = false
    }
  }, [fetcher?.state, fetcher?.data])

  const isSubmitting = fetcher
    ? fetcher.state !== 'idle'
    : navigation.state !== 'idle'

  const FormComponent = fetcher ? fetcher.Form : Form

  return (
    <AlertDialog {...actions}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{desc}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {cancelBtnText ?? 'Cancel'}
          </AlertDialogCancel>
          <FormComponent method="POST" action={action}>
            {children}
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              loading={isSubmitting}
            >
              {confirmText ?? 'Continue'}
            </Button>
          </FormComponent>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
