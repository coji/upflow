import { useField } from 'remix-validated-form'
import type { InputProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Input, FormErrorMessage } from '@chakra-ui/react'

interface AppInputProps extends InputProps {
  name: string
  label: string
  isRequired?: boolean
}
export const AppInput = ({ name, label, isRequired, ...rest }: AppInputProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error} isRequired>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Input {...getInputProps({ id: name, ...rest })} />
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
