import { loadConfig, allRepositories } from '../config'

interface TestCommandProps {
  repositoryId?: string
}

export const testCommand = async (props: TestCommandProps) => {
  if (props.repositoryId) {
    console.log(await loadConfig(props.repositoryId))
  } else {
    console.log(await allRepositories())
  }
}
