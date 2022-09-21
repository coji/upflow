import { useField } from 'remix-validated-form'
import type { InputProps } from '@chakra-ui/react'
import { FormControl, FormLabel, RadioGroup, FormErrorMessage } from '@chakra-ui/react'

interface AppRadioGroupProps extends InputProps {
  name: string
  label: string
  children: React.ReactElement
}
export const AppRadioGroup = ({ name, label, children, ...rest }: AppRadioGroupProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <RadioGroup {...getInputProps()}>{children}</RadioGroup>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
