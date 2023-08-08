import { prisma } from '~/app/services/db.server'

export const getExportSetting = async (companyId: string) =>
  await prisma.exportSetting.findFirst({ where: { companyId } })

interface upsertExportSettingProps {
  companyId: string
  sheetId: string
  clientEmail: string
  privateKey: string
}
export const upsertExportSetting = async ({ companyId, sheetId, clientEmail, privateKey }: upsertExportSettingProps) =>
  await prisma.exportSetting.upsert({
    where: {
      companyId,
    },
    create: {
      companyId,
      sheetId,
      clientEmail,
      privateKey,
    },
    update: {
      sheetId,
      clientEmail,
      privateKey,
    },
  })
