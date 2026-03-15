import JSZip from 'jszip'
import { randomUUID } from 'node:crypto'
import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { orgContext } from '~/app/middleware/context'
import type { Route } from './+types/export-parquet'
import { iterateExportRows } from './settings/data-management/+functions/build-export-data.server'
import { writeParquetFile } from './settings/data-management/+functions/write-parquet.server'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)

  const url = new URL(request.url)
  const includeRaw = url.searchParams.get('includeRaw') === 'true'

  const tmpPath = join(tmpdir(), `upflow-export-${randomUUID()}.parquet`)
  try {
    // Stream rows from SQLite → Parquet temp file
    const rows = iterateExportRows(organization.id, { includeRaw })
    await writeParquetFile(rows, tmpPath, { includeRaw })

    // Read compressed Parquet file + data dictionary
    const parquetData = readFileSync(tmpPath)
    const dataDictionary = readFileSync(
      resolve(
        import.meta.dirname,
        'settings/data-management/+data/DATA_DICTIONARY.md',
      ),
      'utf-8',
    )

    // Bundle into ZIP
    const zip = new JSZip()
    zip.file('data.parquet', parquetData)
    zip.file('DATA_DICTIONARY.md', dataDictionary)
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

    const today = new Date().toISOString().slice(0, 10)
    const filename = `upflow-export-${organization.slug}-${today}.zip`

    return new Response(Buffer.from(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } finally {
    try {
      unlinkSync(tmpPath)
    } catch {
      // temp file may not exist if writeParquetFile failed early
    }
  }
}
