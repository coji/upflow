// 使い捨て DB を読み取り専用で開く。drive.mjs からも CLI からも使う。
//   DATA_DIR=... node db.mjs shared|tenant "SELECT ..."
import Database from 'better-sqlite3'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function dbPath(dataDir, which) {
  if (which === 'shared') return path.join(dataDir, 'data.db')
  if (which === 'tenant') {
    // seed は organization を 1 つ (techtalk) だけ作るので tenant DB も 1 つ
    const files = readdirSync(dataDir).filter(
      (f) => f.startsWith('tenant_') && f.endsWith('.db'),
    )
    if (files.length !== 1) {
      throw new Error(
        `tenant DB が 1 つではありません (${files.join(', ') || 'なし'})`,
      )
    }
    return path.join(dataDir, files[0])
  }
  throw new Error(`shared か tenant を指定してください: ${which}`)
}

export function query(dataDir, which, sql, params = []) {
  const db = new Database(dbPath(dataDir, which), {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return db.prepare(sql).all(...params)
  } finally {
    db.close()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [which, sql] = process.argv.slice(2)
  const dataDir = process.env.DATA_DIR
  if (!dataDir || !which || !sql) {
    console.error('usage: DATA_DIR=... node db.mjs shared|tenant "SELECT ..."')
    process.exit(2)
  }
  console.log(JSON.stringify(query(dataDir, which, sql), null, 2))
}
