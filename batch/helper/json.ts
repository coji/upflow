import fs from 'fs'
import { jsonPath } from './path'

/**
 * JSON ファイルの読み込み
 *
 * @param filename
 */
export const load = <T>(filename: string) =>
  JSON.parse(fs.readFileSync(jsonPath(filename)).toString()) as T

/**
 * JSON ファイルの保存
 *
 * @param filename
 * @param content
 */
export const save = (filename: string, content: unknown) =>
  fs.writeFileSync(jsonPath(filename), JSON.stringify(content, null, 2))
