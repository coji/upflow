import { useEffect, useRef } from 'react'
import { Form, useNavigation, type FetcherWithComponents } from 'react-router'

/**
 * Tracks form submission state for dialog components that use a fetcher.
 * Handles auto-closing the dialog when the fetcher completes successfully
 * (i.e., response has no `error` key).
 */
export function useFormDialogState<T>({
  fetcher,
  onClose,
}: {
  fetcher?: FetcherWithComponents<T>
  onClose: () => void
}) {
  const navigation = useNavigation()
  const didSubmitRef = useRef(false)

  // Track when a submission starts
  useEffect(() => {
    if (fetcher?.state === 'submitting') {
      didSubmitRef.current = true
    }
  }, [fetcher?.state])

  // Close dialog when fetcher completes successfully after our submission
  useEffect(() => {
    if (didSubmitRef.current && fetcher?.state === 'idle') {
      const responseData = fetcher.data as Record<string, unknown> | undefined
      if (responseData && !('error' in responseData)) {
        onClose()
      }
      didSubmitRef.current = false
    }
  }, [fetcher?.state, fetcher?.data, onClose])

  const isSubmitting = fetcher
    ? fetcher.state !== 'idle'
    : navigation.state !== 'idle'

  const FormComponent = fetcher ? fetcher.Form : Form

  return { isSubmitting, FormComponent }
}
