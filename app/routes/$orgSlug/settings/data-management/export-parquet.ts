import { createReadableStreamFromReadable } from '@react-router/node'
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

  const includeRaw =
    new URL(request.url).searchParams.get('includeRaw') === 'true'

  const tmpPath = join(tmpdir(), `upflow-export-${randomUUID()}.parquet`)

  // Stream rows from SQLite → Parquet temp file
  try {
    const rows = iterateExportRows(organization.id, { includeRaw })
    await writeParquetFile(rows, tmpPath, { includeRaw })
  } catch (e) {
    await unlink(tmpPath).catch(() => {})
    throw e
  }

  // Stream Parquet file into ZIP (no full-file read into memory)
  const zip = new JSZip()
  zip.file('data.parquet', createReadStream(tmpPath))
  zip.file('DATA_DICTIONARY.md', dataDictionary)

  // JSZip's generateNodeStream returns a legacy NodeJS.ReadableStream (not
  // a stream.Readable). Readable.wrap() bridges the legacy interface so we
  // can use it with createReadableStreamFromReadable.
  const readable = new Readable().wrap(
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }),
  )

  // Clean up temp file when stream terminates (end, error, or destroy)
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    unlink(tmpPath).catch((e) =>
      console.warn('Failed to clean up temp file', tmpPath, e),
    )
  }
  readable.on('close', cleanup)

  // Abort the stream if the client disconnects
  request.signal.addEventListener('abort', () => readable.destroy(), {
    once: true,
  })

  const today = new Date().toISOString().slice(0, 10)
  const filename = `upflow-export-${organization.slug}-${today}.zip`

  return new Response(createReadableStreamFromReadable(readable), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
