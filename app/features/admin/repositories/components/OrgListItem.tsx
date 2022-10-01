import { Stack, Box, Checkbox } from '@chakra-ui/react'

interface OrgListItemProps {
  org: string
  isChecked: boolean
  isIndeterminate: boolean
  checkedRepoNum: number
  orgRepoNum: number
  onChange: (org: string, isChecked: boolean) => void
}
export const OrgListItem = ({
  org,
  isChecked,
  isIndeterminate,
  checkedRepoNum,
  orgRepoNum,
  onChange
}: OrgListItemProps) => {
  return (
    <Stack direction="row" align="center">
      <Checkbox
        isChecked={isChecked}
        isIndeterminate={isIndeterminate}
        onClick={(e) => {
          e.stopPropagation() // acordion 開閉させない
        }}
        onChange={(e) => {
          onChange(org, isChecked)
        }}
      ></Checkbox>
      <Box>{org}</Box>
      <Box fontSize="sm" color="gray.500">
        {checkedRepoNum} / {orgRepoNum} repos
      </Box>
    </Stack>
  )
}
