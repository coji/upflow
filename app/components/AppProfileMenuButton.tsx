import { Avatar, MenuButton } from '@chakra-ui/react'
import type { MenuButtonProps, AvatarProps } from '@chakra-ui/react'

type UserAvatarProps = AvatarProps
const UserAvatar = ({ ...rest }: UserAvatarProps) => {
  return <Avatar size="sm" {...rest} />
}

interface ProfileMenuButtonProps extends MenuButtonProps {
  name?: string
  pictureUrl?: string
}
export const AppProfileMenuButton = ({ name = '', pictureUrl, ...props }: ProfileMenuButtonProps) => {
  return (
    <MenuButton flexShrink={0} rounded="full" outline="0" _focus={{ shadow: 'outline' }} {...props}>
      <UserAvatar name={name} src={pictureUrl} />
    </MenuButton>
  )
}
