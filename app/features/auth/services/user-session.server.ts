import { redirect } from '@remix-run/node'
import type { SessionUser } from '../types/types'
import { authenticator, sessionStorage } from './authenticator.server'

/**
 * リクエストに含まれるCookieからセッション情報を取得する
 * @param request
 * @returns
 */
async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie')
  return await sessionStorage.getSession(cookie)
}

/**
 * リクエストからセッションの中に含まれる userId を取得する
 * @param request
 * @returns
 */
async function getSessionUser(request: Request) {
  const session = await getSession(request)
  const sessionUser = session.get(authenticator.sessionKey) as
    | SessionUser
    | undefined
  return sessionUser
}

/**
 * リクエストに含まれるcookieセッションからユーザを取得する
 * @param request
 * @returns
 */
export const requireUser = async (request: Request) => {
  const sessionUser = await getSessionUser(request)
  if (sessionUser === undefined) throw redirect('/login')
  return sessionUser
}
export const requireAdminUser = async (request: Request) => {
  const sessionUser = await requireUser(request)
  if (sessionUser.role !== 'admin') throw redirect('/')
  return sessionUser
}
