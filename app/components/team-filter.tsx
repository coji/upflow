import { useSearchParams } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui'

interface Team {
  id: string
  name: string
}

export function TeamFilter({ teams }: { teams: Team[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTeamId = searchParams.get('team') ?? '__all__'

  if (teams.length === 0) return null

  return (
    <Select
      value={currentTeamId}
      onValueChange={(value) => {
        setSearchParams((prev) => {
          if (value === '__all__') {
            prev.delete('team')
          } else {
            prev.set('team', value)
          }
          return prev
        })
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue placeholder="All Teams" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All Teams</SelectItem>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
