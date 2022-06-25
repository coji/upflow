import path from 'path'

/**
 * JSON ファイルのパスを作成
 *
 * @param filename - ファイル名
 */
export const jsonPath = (filename: string) =>
  path.join(__dirname, '..', '..', 'json', filename)

export const jsonFilename = (element: string, iid: number) =>
  `/${element}/${iid}-${element}.json`

export const commitsJsonFilename = (iid: number) => jsonFilename('commits', iid)
export const discussionsJsonFilename = (iid: number) =>
  jsonFilename('discussions', iid)
