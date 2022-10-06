import { useIsSubmitting } from 'remix-validated-form'
import type { ButtonProps } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'

export const AppSubmitButton = ({ form, ...rest }: ButtonProps) => {
  const isSubmitting = useIsSubmitting(form)
  return (
    <Button type="submit" disabled={isSubmitting} form={form} {...rest}>
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </Button>
  )
}
