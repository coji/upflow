import { closeDb } from '~/app/services/db.server'
import { closeAllTenantDbs } from '~/app/services/tenant-db.server'

/**
 * CLI コマンド終了時に全 DB 接続を閉じてプロセスを正常終了させる。
 */
export async function shutdown(): Promise<void> {
  await closeAllTenantDbs()
  await closeDb()
}
