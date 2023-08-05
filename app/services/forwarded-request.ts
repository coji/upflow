/**
 * 本番環境でリバースプロクシされてる場合などで forwarded 系ヘッダに応じた適正なリクエストURLを生成する
 * @param req
 * @returns
 */
export const createForwardedRequest = (req: Request) => {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwardedProto = req.headers.get('x-forwarded-proto')

  const url = new URL(req.url)
  const protocol = forwardedProto ? forwardedProto + ':' : url.protocol
  const hostname = forwardedHost ?? url.hostname

  const request = new Request(`${protocol}//${hostname}${url.pathname}${url.search}${url.hash}`, req)
  return request
}
