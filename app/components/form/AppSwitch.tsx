import { useField } from 'remix-validated-form'
import type { SwitchProps } from '@chakra-ui/react'
import { FormControl, FormLabel, Switch, FormErrorMessage } from '@chakra-ui/react'

interface AppSwitchProps extends SwitchProps {
  name: string
  label: string
}
export const AppSwitch = ({ name, label, isRequired, ...rest }: AppSwitchProps) => {
  const { error, getInputProps } = useField(name)

  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <Switch {...getInputProps({ type: 'checkbox', id: name, ...rest })}></Switch>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
