import path from 'path'

interface createPathBuilderProps {
  companyId: string
  repositoryId: string
}
export const createPathBuilder = ({ companyId, repositoryId }: createPathBuilderProps) => {
  const jsonPath = (filename: string) => {
    // JSON データの保存場所
    const JSON_DIR = path.join(process.env.UPFLOW_DATA_DIR ?? path.join(__dirname, '..', 'data'), 'json')
    return path.join(JSON_DIR, companyId, repositoryId, filename)
  }
  const jsonFilename = (element: string, iid: number) => `${element}/${iid}-${element}.json`
  const commitsJsonFilename = (iid: number) => jsonFilename('commits', iid)
  const discussionsJsonFilename = (iid: number) => jsonFilename('discussions', iid)
  const reviewJsonFilename = (iid: number) => jsonFilename('reviews', iid)

  const releaseCommitsJsonFilename = (sha: string) => {
    const subDir = sha.substring(0, 2)
    return `release-commits/${subDir}/${sha}.json`
  }
  const releaseCommitsGlob = () => jsonPath(path.join('release-commits', '**', '*.json'))
  const sha = (filename: string) => path.basename(filename, '.json')

  return {
    jsonPath,
    commitsJsonFilename,
    discussionsJsonFilename,
    reviewJsonFilename,
    releaseCommitsJsonFilename,
    releaseCommitsGlob,
    sha,
  }
}
