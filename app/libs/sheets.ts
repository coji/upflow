import { sheets, auth } from '@googleapis/sheets'

interface createSheetApiParams {
  sheetId: string
  clientEmail: string
  privateKey: string
}
export const createSheetApi = ({ sheetId, clientEmail, privateKey }: createSheetApiParams) => {
  const paste = async (data: string) => {
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
    await sheet.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            deleteRange: {
              range: {
                sheetId: 0,
                startColumnIndex: 0,
                endColumnIndex: 99
              },
              shiftDimension: 'COLUMNS'
            }
          },
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
  }

  return { paste }
}
