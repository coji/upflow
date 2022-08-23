import type { UseMenuButtonProps } from '@chakra-ui/react'
import { Avatar, Flex, useMenuButton } from '@chakra-ui/react'

interface UserAvatarProps {
  name?: string
}
const UserAvatar = ({ name = '' }: UserAvatarProps) => {
  return <Avatar size="sm" name={name} />
}

interface ProfileMenuButtonProps extends UseMenuButtonProps {
  name?: string
}
export const AppProfileMenuButton = ({ name = '', ...props }: ProfileMenuButtonProps) => {
  const buttonProps = useMenuButton(props)
  return (
    <Flex {...buttonProps} as="button" flexShrink={0} rounded="full" outline="0" _focus={{ shadow: 'outline' }}>
      <UserAvatar name={name} />
    </Flex>
  )
}
