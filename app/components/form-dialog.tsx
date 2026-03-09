import { useCallback } from 'react'
import type { FetcherWithComponents } from 'react-router'
import { Button } from '~/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/app/components/ui/dialog'
import { useFormDialogState } from '~/app/hooks/use-form-dialog-state'
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
    ...dialogProps
  } = props

  const onClose = useCallback(() => dialogProps.onOpenChange(false), [])
  const { isSubmitting, FormComponent } = useFormDialogState({
    fetcher,
    onClose,
  })

  return (
    <Dialog {...dialogProps}>
      <DialogContent className={cn(className)}>
        <FormComponent method="POST" action={action} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{desc}</div>
            </DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => dialogProps.onOpenChange(false)}
            >
              {cancelBtnText ?? 'Cancel'}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={disabled}>
              {confirmText ?? 'Continue'}
            </Button>
          </DialogFooter>
        </FormComponent>
      </DialogContent>
    </Dialog>
  )
}
