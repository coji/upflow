import { createSimpleLogger } from 'simple-node-logger'

export const logger = createSimpleLogger({ level: 'info', timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS' })
