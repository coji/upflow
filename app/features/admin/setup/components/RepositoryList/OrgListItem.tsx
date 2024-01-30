import { Checkbox, HStack, Label, Spacer } from '~/app/components/ui'

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
  checkedRepoNum,
  orgRepoNum,
  onChange,
}: OrgListItemProps) => {
  return (
    <HStack className="flex-1">
      <Checkbox
        id={`org-${org}`}
        checked={isChecked}
        onClick={(e) => {
          onChange(org, isChecked)
          e.stopPropagation() // accordion 開閉させない
        }}
      />
      <Label htmlFor={`org-${org}`}>{org}</Label>

      <Spacer />
      <div className="text-sm font-normal">
        {checkedRepoNum} / {orgRepoNum} repos
      </div>
    </HStack>
  )
}
