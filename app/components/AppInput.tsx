import { useField } from 'remix-validated-form'
import type { InputProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Input, FormErrorMessage } from '@chakra-ui/react'

interface AppInputProps extends InputProps {
  name: string
  label: string
}
export const AppInput = ({ name, label, ...rest }: AppInputProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Input id={name} {...getInputProps()} {...rest} />
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
