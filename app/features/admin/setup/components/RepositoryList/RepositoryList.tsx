import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Spacer,
} from "@chakra-ui/react"
import React, { useCallback, useState } from "react"
import { uniq } from "remeda"
import type { GitRepo, CheckedRepositories } from "../../interfaces/model"
import { OrgListItem } from "./OrgListItem"
import { OrgRepositoryList } from "./OrgRepositoryList"
import dayjs from "dayjs"

interface RepositoryListProps {
  allRepos: GitRepo[]
  onChange: (repos: GitRepo[]) => void // 選択変更
}
export const RepositoryList = ({ allRepos, onChange }: RepositoryListProps) => {
  const [checkedRepos, setCheckedRepos] = useState<CheckedRepositories>({})
  const orgs = uniq(allRepos.map((repo) => repo.owner) ?? [])

  // 選択されたリポジトリリスト。IDのハッシュから配列にする。
  const selectedRepos = useCallback(
    (checked: CheckedRepositories) =>
      allRepos.filter((repo) => Object.keys(checked).includes(repo.id)) || [],
    [allRepos]
  )

  // organization をチェック・クリアされたらまとめてレポジトリもチェック・クリア
  const handleClickOrgCheckbox = useCallback(
    (org: string, isPrevChecked: boolean) => {
      const orgRepos =
        allRepos.filter(
          (repo) =>
            repo.owner === org &&
            dayjs(repo.pushedAt) > dayjs().add(-90, "days")
        ) || []
      const newCheckedRepos = { ...checkedRepos }
      for (const repo of orgRepos) {
        if (isPrevChecked) {
          delete newCheckedRepos[repo.id]
        } else {
          newCheckedRepos[repo.id] = true
        }
      }
      setCheckedRepos(newCheckedRepos)
      onChange(selectedRepos(newCheckedRepos))
    },
    [allRepos, checkedRepos, onChange, selectedRepos]
  )

  // リポジトリをチェック・クリア
  const handleClickRepoCheckbox = useCallback(
    (id: string) => {
      const newCheckedRepos = { ...checkedRepos }
      if (checkedRepos[id]) {
        delete newCheckedRepos[id]
      } else {
        newCheckedRepos[id] = true
      }
      setCheckedRepos(newCheckedRepos)
      onChange(selectedRepos(newCheckedRepos))
    },
    [checkedRepos, onChange, selectedRepos]
  )

  // 初期状態で選択済みのリポジトリ
  /*
  useEffect(() => {
    if (allRepos) {
      const prevCheckedRepos: { [id: string]: boolean } = {}
      for (const repo of config.repositories) {
        prevCheckedRepos[repo.id] = true
      }
      setCheckedRepos(prevCheckedRepos)
    }
  }, [data, config.repositories])
  */

  return (
    <Accordion allowToggle>
      {!!orgs &&
        orgs.map((org) => {
          const orgRepos = allRepos.filter((repo) => repo.owner == org) || []
          const checkedRepoNum = orgRepos.filter(
            (repo) => !!checkedRepos[repo.id]
          ).length
          const isOrgChecked = checkedRepoNum > 0
          const isOrgIndeterminate =
            checkedRepoNum > 0 && checkedRepoNum != orgRepos.length

          return (
            <React.Fragment key={org}>
              <AccordionItem>
                <AccordionButton display="flex">
                  <OrgListItem
                    org={org}
                    isChecked={isOrgChecked}
                    isIndeterminate={isOrgIndeterminate}
                    checkedRepoNum={checkedRepoNum}
                    orgRepoNum={orgRepos.length}
                    onChange={handleClickOrgCheckbox}
                  />
                  <Spacer />
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel>
                  <OrgRepositoryList
                    orgRepos={orgRepos}
                    checkedRepos={checkedRepos}
                    onCheck={handleClickRepoCheckbox}
                  ></OrgRepositoryList>
                </AccordionPanel>
              </AccordionItem>
            </React.Fragment>
          )
        })}
    </Accordion>
  )
}
