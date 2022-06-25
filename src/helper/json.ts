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
export const save = <T>(filename: string, content: any) =>
  fs.writeFileSync(jsonPath(filename), JSON.stringify(content, null, 2))
