import { useField } from 'remix-validated-form'
import type { InputProps } from '@chakra-ui/react'
import { FormControl, FormLabel, RadioGroup, FormErrorMessage } from '@chakra-ui/react'

interface AppRadioGroupProps extends InputProps {
  name: string
  label: string
  isRequired?: boolean
  children: React.ReactElement
}
export const AppRadioGroup = ({ name, label, isRequired, children, ...rest }: AppRadioGroupProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error} isRequired={isRequired}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <RadioGroup {...getInputProps({ id: name, ...rest })}>{children}</RadioGroup>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
