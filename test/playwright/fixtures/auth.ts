import path from 'node:path'

/** Written by auth setup project; consumed as Playwright storageState. */
export const adminStorageStatePath = path.join(
  import.meta.dirname,
  '..',
  '.auth',
  'admin.json',
)
