import { auth, sheets } from '@googleapis/sheets'

interface createSheetApiParams {
  spreadsheetId: string
  sheetTitle: string
  clientEmail: string
  privateKey: string
}
export const createSheetApi = ({
  spreadsheetId,
  sheetTitle,
  clientEmail,
  privateKey,
}: createSheetApiParams) => {
  const paste = async (data: string) => {
    const jwt = new auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    await jwt.authorize()

    const sheet = sheets({
      version: 'v4',
      auth: jwt,
    })

    const res = await sheet.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    })
    if (!res?.data.sheets) {
      throw new Error('invalid sheet')
    }

    let destSheet = res.data.sheets
      .map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
      }))
      .filter((s) => s.title === sheetTitle)
      .at(0)

    if (!destSheet) {
      const batchRes = await sheet.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      })
      const sheetId =
        batchRes?.data?.replies?.[0]?.addSheet?.properties?.sheetId
      const title = batchRes?.data?.replies?.[0]?.addSheet?.properties?.title
      if (sheetId == null || title == null) {
        throw new Error(
          `batchUpdate AddSheetResponse missing sheetId/title: ${JSON.stringify(batchRes?.data)}`,
        )
      }

      destSheet = { sheetId, title }
    }

    await sheet.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteRange: {
              range: {
                sheetId: destSheet.sheetId,
                startColumnIndex: 0,
                endColumnIndex: 99,
              },
              shiftDimension: 'COLUMNS',
            },
          },
          {
            pasteData: {
              coordinate: {
                sheetId: destSheet.sheetId,
                rowIndex: 0,
                columnIndex: 0,
              },
              type: 'PASTE_VALUES',
              delimiter: '\t',
              data,
            },
          },
        ],
      },
    })
  }

  return { paste }
}
