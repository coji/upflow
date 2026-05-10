import { processCommand } from './process'

interface RecalculateCommandProps {
  organizationId?: string
}

export async function recalculateCommand({
  organizationId,
}: RecalculateCommandProps) {
  await processCommand({ organizationId, export: false })
}
