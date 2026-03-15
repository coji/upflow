import JSZip from 'jszip'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { orgContext } from '~/app/middleware/context'
import dataDictionary from './+data/DATA_DICTIONARY.md?raw'
import { iterateExportRows } from './+functions/build-export-data.server'
import { writeParquetFile } from './+functions/write-parquet.server'
import type { Route } from './+types/export-parquet'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)

  const url = new URL(request.url)
  const includeRaw = url.searchParams.get('includeRaw') === 'true'

  const tmpPath = join(tmpdir(), `upflow-export-${randomUUID()}.parquet`)

  // Stream rows from SQLite → Parquet temp file
  const rows = iterateExportRows(organization.id, { includeRaw })
  await writeParquetFile(rows, tmpPath, { includeRaw })

  // Stream Parquet file into ZIP (no full-file read into memory)
  const zip = new JSZip()
  zip.file('data.parquet', createReadStream(tmpPath))
  zip.file('DATA_DICTIONARY.md', dataDictionary)

  const zipStream = zip.generateNodeStream({
    type: 'nodebuffer',
    streamFiles: true,
  })

  // Clean up temp file once the ZIP stream finishes reading it
  const cleanup = () => {
    unlink(tmpPath).catch((e) =>
      console.warn('Failed to clean up temp file', tmpPath, e),
    )
  }
  zipStream.on('end', cleanup)
  zipStream.on('error', cleanup)

  // Convert Node stream to Web ReadableStream for Response
  const webStream = Readable.toWeb(Readable.from(zipStream))

  const today = new Date().toISOString().slice(0, 10)
  const filename = `upflow-export-${organization.slug}-${today}.zip`

  return new Response(webStream as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
