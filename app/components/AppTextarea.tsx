import { useField } from 'remix-validated-form'
import type { TextareaProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Textarea, FormErrorMessage } from '@chakra-ui/react'

interface AppTextareaProps extends TextareaProps {
  name: string
  label: string
}
export const AppTextarea = ({ name, label, ...rest }: AppTextareaProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Textarea id={name} {...getInputProps()} {...rest} />
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
