import fs from 'fs'
import path from 'path'

// JSON データの保存場所
const JSON_DIR = path.join(process.env.UPFLOW_DATA_DIR ?? path.join(__dirname, '..', '..', 'data'), 'json')

/**
 * JSON ファイルのパスを作成
 *
 * @param filename - ファイル名
 */
export const jsonPath = (filename: string) => path.join(JSON_DIR, filename)

export const jsonFilename = (element: string, iid: number) => `${element}/${iid}-${element}.json`

export const commitsJsonFilename = (iid: number) => jsonFilename('commits', iid)

export const discussionsJsonFilename = (iid: number) => jsonFilename('discussions', iid)

export const releaseCommitsJsonFilename = (sha: string) => {
  const subDir = sha.substring(0, 2)
  fs.mkdirSync(jsonPath(`release-commits/${subDir}`), { recursive: true })
  return `release-commits/${subDir}/${sha}.json`
}

export const releaseCommitsGlob = () => path.join(JSON_DIR, 'release-commits', '**', '*.json')

export const sha = (filename: string) => path.basename(filename, '.json')
