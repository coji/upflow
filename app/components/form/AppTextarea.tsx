import { useField } from 'remix-validated-form'
import type { TextareaProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Textarea, FormErrorMessage } from '@chakra-ui/react'

interface AppTextareaProps extends TextareaProps {
  name: string
  label: string
  isRequired?: boolean
}
export const AppTextarea = ({ name, label, isRequired, ...rest }: AppTextareaProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error} isRequired={isRequired}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Textarea {...getInputProps({ id: name, ...rest })} />
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
