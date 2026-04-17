/**
 * Conform の `submission.reply({ formErrors })` が返す lastResult 形状から
 * フォームレベル (field path `''`) の最初のエラーメッセージを取り出す。
 * Conform の内部形状依存を UI コンポーネントから隠蔽するための helper。
 */
export function extractFormError(
  data:
    | {
        lastResult?: {
          error?: Record<string, string[] | undefined> | null
        } | null
      }
    | null
    | undefined,
): string | undefined {
  const formErrors = data?.lastResult?.error?.['']
  return Array.isArray(formErrors) ? formErrors[0] : undefined
}
