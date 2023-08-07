import { Avatar, AvatarFallback, AvatarImage, Button, DropdownMenuTrigger } from '~/app/components/ui'

interface ProfileMenuButtonProps {
  name?: string
  pictureUrl?: string
}
export const AppProfileMenuButton = ({ name = '', pictureUrl }: ProfileMenuButtonProps) => {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Avatar>
          <AvatarImage src={pictureUrl} alt={name} />
          <AvatarFallback>{name}</AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>
  )
}
