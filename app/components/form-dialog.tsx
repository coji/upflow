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
import { cn } from '~/app/libs/utils'

interface FormDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  desc: React.JSX.Element | string
  cancelBtnText?: string
  confirmText?: React.ReactNode
  disabled?: boolean
  fetcher?: FetcherWithComponents<T>
  action?: string
  className?: string
  children?: React.ReactNode
}

export function FormDialog<T>(props: FormDialogProps<T>) {
  const {
    title,
    desc,
    children,
    className,
    confirmText,
    cancelBtnText,
    disabled = false,
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
    if (didSubmitRef.current && fetcher?.state === 'idle' && fetcher.data) {
      actions.onOpenChange(false)
      didSubmitRef.current = false
    }
  }, [fetcher?.state, fetcher?.data])

  const isSubmitting = fetcher
    ? fetcher.state === 'submitting'
    : navigation.state === 'submitting'

  const FormComponent = fetcher ? fetcher.Form : Form

  return (
    <AlertDialog {...actions}>
      <AlertDialogContent className={cn(className)}>
        <FormComponent method="POST" action={action}>
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>{desc}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {cancelBtnText ?? 'Cancel'}
            </AlertDialogCancel>
            <Button type="submit" disabled={disabled || isSubmitting}>
              {confirmText ?? 'Continue'}
            </Button>
          </AlertDialogFooter>
        </FormComponent>
      </AlertDialogContent>
    </AlertDialog>
  )
}
