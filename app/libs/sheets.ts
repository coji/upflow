import { sheets, auth } from '@googleapis/sheets'

interface createSheetApiParams {
  sheetId: string
  clientEmail: string
  privateKey: string
}
export const createSheetApi = async ({ sheetId, clientEmail, privateKey }: createSheetApiParams) => {
  const jwt = new auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  await jwt.authorize()

  const sheet = sheets({
    version: 'v4',
    auth: jwt
  })

  const paste = async (data: string) =>
    await sheet.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            pasteData: {
              coordinate: {
                sheetId: 0,
                rowIndex: 0,
                columnIndex: 0
              },
              type: 'PASTE_VALUES',
              delimiter: '\t',
              data
            }
          }
        ]
      }
    })

  return { sheet, paste }
}
