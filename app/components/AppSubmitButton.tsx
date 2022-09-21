import { useIsSubmitting } from 'remix-validated-form'
import { Button } from '@chakra-ui/react'

interface AppSubmitButtonProps {
  formId?: string
}
export const AppSubmitButton = ({ formId }: AppSubmitButtonProps) => {
  const isSubmitting = useIsSubmitting(formId)
  return (
    <Button type="submit" disabled={isSubmitting} colorScheme="blue">
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </Button>
  )
}
