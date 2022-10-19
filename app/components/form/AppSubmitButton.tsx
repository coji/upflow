import { useIsSubmitting } from 'remix-validated-form'
import type { ButtonProps } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'

interface AppSubmitButtonProps extends ButtonProps {
  children?: React.ReactNode
}
export const AppSubmitButton = ({ form, children, ...rest }: AppSubmitButtonProps) => {
  const isSubmitting = useIsSubmitting(form)
  return (
    <Button type="submit" disabled={isSubmitting} form={form} {...rest}>
      {isSubmitting ? 'Submitting...' : children ?? 'Submit'}
    </Button>
  )
}
