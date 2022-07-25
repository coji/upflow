import path from 'path'
import fs from 'fs'

/**
 * JSON ファイルのパスを作成
 *
 * @param filename - ファイル名
 */
export const jsonPath = (filename: string) => path.join(__dirname, '..', 'json', filename)

export const jsonFilename = (element: string, iid: number) => `/${element}/${iid}-${element}.json`

export const commitsJsonFilename = (iid: number) => jsonFilename('commits', iid)

export const discussionsJsonFilename = (iid: number) => jsonFilename('discussions', iid)

export const releaseCommitsJsonFilename = (sha: string) => {
  const subdir = sha.substring(0, 2)
  fs.mkdirSync(jsonPath(`release-commits/${subdir}`), { recursive: true })
  return `release-commits/${subdir}/${sha}.json`
}

export const releaseCommitsGlob = () => path.join(__dirname, '..', '..', 'json', 'release-commits', '**', '*.json')

export const sha = (filename: string) => path.basename(filename, '.json')
