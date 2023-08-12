import { CaretSortIcon, CheckIcon, PlusCircledIcon } from '@radix-ui/react-icons'
import { useNavigate } from '@remix-run/react'
import { useState } from 'react'
import {
  Avatar,
  AvatarFallback,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui'
import { cn } from '~/app/libs/utils'

export interface Companies {
  id: string
  name: string
  teams: Team[]
}

export interface Team {
  id: string
  name: string
}

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>
interface TeamSwitcherProps extends PopoverTriggerProps {
  companies: Companies[]
  selectedTeam?: Team
  isAdmin: boolean
}

export const TeamSwitcher = ({ className, companies, selectedTeam, isAdmin }: TeamSwitcherProps) => {
  const [open, setOpen] = useState(false)
  const [showNewTeamDialog, setShowNewTeamDialog] = useState(false)
  const navigate = useNavigate()

  return (
    <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a team"
            className={cn('w-[10rem] justify-between md:w-[12rem]', className)}
          >
            {selectedTeam ? (
              <>
                <Avatar className="mr-2 h-5 w-5">
                  <AvatarFallback>{selectedTeam.name}</AvatarFallback>
                </Avatar>
                {selectedTeam.name}
                <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
              </>
            ) : (
              <div>Select Team...</div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[10rem] p-0 md:w-[12rem]">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search team..." />
              <CommandEmpty>No team found.</CommandEmpty>
              {companies.map((company) => (
                <CommandGroup key={company.name} heading={company.name}>
                  {company.teams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => {
                        setOpen(false)
                        navigate(`${isAdmin ? '/admin' : ''}/${company.id}`)
                      }}
                      className="text-sm"
                    >
                      {team.name}
                      <CheckIcon
                        className={cn('ml-auto h-4 w-4', selectedTeam?.id === team.id ? 'opacity-100' : 'opacity-0')}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <DialogTrigger asChild>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false)
                      setShowNewTeamDialog(true)
                    }}
                  >
                    <PlusCircledIcon className="mr-2 h-5 w-5" />
                    Create Team
                  </CommandItem>
                </DialogTrigger>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Add a new team to manage products and customers.</DialogDescription>
        </DialogHeader>
        <div>
          <div className="space-y-4 py-2 pb-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team name</Label>
              <Input id="name" placeholder="Acme Inc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Subscription plan</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <span className="font-medium">Free</span> -{' '}
                    <span className="text-muted-foreground">Trial for two weeks</span>
                  </SelectItem>
                  <SelectItem value="pro">
                    <span className="font-medium">Pro</span> -{' '}
                    <span className="text-muted-foreground">$9/month per user</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNewTeamDialog(false)}>
            Cancel
          </Button>
          <Button type="submit">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
