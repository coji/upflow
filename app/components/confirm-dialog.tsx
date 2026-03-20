import type { SubmissionResult } from '@conform-to/react'
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

interface ConfirmDialogData {
  shouldConfirm?: boolean
  lastResult?: SubmissionResult
}

interface ConfirmDialogProps {
  title: React.ReactNode
  desc: React.JSX.Element | string
  cancelBtnText?: string
  confirmText?: React.ReactNode
  destructive?: boolean
  fetcher: FetcherWithComponents<ConfirmDialogData>
  action?: string
  children?: React.ReactNode
}

/**
 * Server-driven confirm dialog.
 * Opens when `fetcher.data?.shouldConfirm === true`.
 * Closes on cancel (via `fetcher.reset()`) or on successful mutation
 * (server responds without `shouldConfirm`).
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title,
    desc,
    children,
    confirmText,
    cancelBtnText,
    destructive,
    fetcher,
    action,
  } = props

  const open = fetcher.data?.shouldConfirm === true
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) fetcher.reset()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{desc}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {fetcher.data?.lastResult?.error?.[''] && (
          <p className="text-destructive text-sm">
            {fetcher.data.lastResult.error[''].join(', ')}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {cancelBtnText ?? 'Cancel'}
          </AlertDialogCancel>
          <fetcher.Form method="POST" action={action}>
            {children}
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              loading={isSubmitting}
            >
              {confirmText ?? 'Continue'}
            </Button>
          </fetcher.Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
