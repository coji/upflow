import dayjs from 'dayjs'
import {
  Badge,
  Checkbox,
  HStack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import type { CheckedRepositories, GithubRepo } from '../../interfaces/model'

interface OrgRepositoryListProps {
  orgRepos: GithubRepo[]
  checkedRepos: CheckedRepositories
  onCheck: (id: string) => void
}
export const OrgRepositoryList = ({
  orgRepos,
  checkedRepos,
  onCheck,
}: OrgRepositoryListProps) => {
  return (
    <Table>
      <TableHeader>
        <TableHead className="w-64">Repository</TableHead>
        <TableHead className="w-64">Path</TableHead>
        <TableHead className="w-40 text-center">Last Pushed</TableHead>
        <TableHead className="w-40 text-center">Created</TableHead>
      </TableHeader>
      <TableBody>
        {orgRepos.map((repo) => {
          const isActive = dayjs(repo.pushedAt) > dayjs().add(-90, 'days')

          return (
            <TableRow
              key={repo.id}
              className={
                isActive
                  ? 'bg-inherit hover:cursor-pointer hover:bg-white'
                  : 'bg-gray-100 hover:cursor-auto hover:bg-gray-100'
              }
              onClick={(e) => {
                onCheck(repo.id) // 行クリックでも発動
              }}
            >
              <TableCell className="w-64 break-all whitespace-break-spaces">
                <HStack>
                  {/* Checkbox はアニメーションするためまとめて変更するとめっちゃ遅いので数が多いこれは input に */}
                  <Checkbox
                    name="repos[]"
                    disabled={!isActive}
                    checked={checkedRepos[repo.id] ?? false}
                    onClick={(e) => {
                      e.stopPropagation() // テーブル行クリックを発動させない
                    }}
                    onChange={() => {
                      onCheck(repo.id)
                    }}
                  />
                  <div>{repo.name}</div>
                </HStack>
              </TableCell>

              <TableCell className="gray-500 w-64 text-xs break-all whitespace-break-spaces">
                {repo.full_name}
              </TableCell>

              <TableCell className="w-40 text-center text-sm text-gray-500">
                <div>
                  {isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>

                <div className="text-xs">
                  {dayjs(repo.pushedAt).format('YYYY-MM-DD')}
                </div>
              </TableCell>

              <TableCell className="w-40 text-center text-xs text-gray-500">
                {dayjs(repo.createdAt).format('YYYY-MM-DD')}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
