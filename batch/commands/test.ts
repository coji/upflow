import { loadConfig, allConfigs } from '../config'

interface TestCommandProps {
  repositoryId?: string
}

export const testCommand = async (props: TestCommandProps) => {
  if (props.repositoryId) {
    console.log(await loadConfig(props.repositoryId))
  } else {
    console.log(await allConfigs())
  }
}
