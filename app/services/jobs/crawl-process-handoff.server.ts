export function shouldTriggerFullOrgProcessJob(input: {
  refresh: boolean
  repositoryId?: string
  prNumbers?: number[]
}): boolean {
  return (
    input.refresh &&
    !input.repositoryId &&
    (!input.prNumbers || input.prNumbers.length === 0)
  )
}
