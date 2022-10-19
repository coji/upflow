import { useField } from 'remix-validated-form'
import type { InputProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Select, FormErrorMessage } from '@chakra-ui/react'

interface AppSelectProps extends InputProps {
  name: string
  label: string
  isRequired?: boolean
  children: React.ReactElement[]
}
export const AppSelect = ({ name, label, isRequired, children, ...rest }: AppSelectProps) => {
  const { error, getInputProps } = useField(name)
  return (
    <FormControl isInvalid={!!error} isRequired={isRequired}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Select {...getInputProps({ id: name, ...rest })}>{children}</Select>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
