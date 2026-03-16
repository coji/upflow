import { useCallback } from 'react'
import type { FetcherWithComponents } from 'react-router'
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
import { useFormDialogState } from '~/app/hooks/use-form-dialog-state'

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

  const onClose = useCallback(
    () => actions.onOpenChange(false),
    [actions.onOpenChange],
  )
  const { isSubmitting, FormComponent } = useFormDialogState({
    fetcher,
    onClose,
  })

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
