import type { SessionUser } from '../types/types'
import { authenticator, sessionStorage } from './authenticator.server'
import { redirect } from '@remix-run/node'

/**
 * リクエストに含まれるCookieからセッション情報を取得する
 * @param request
 * @returns
 */
async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie')
  return sessionStorage.getSession(cookie)
}

/**
 * リクエストからセッションの中に含まれる userId を取得する
 * @param request
 * @returns
 */
async function getSessionUser(request: Request) {
  const session = await getSession(request)
  const sessionUser = session.get(authenticator.sessionKey) as SessionUser | undefined
  return sessionUser
}

/**
 * リクエストに含まれるcookieセッションからユーザを取得する
 * @param request
 * @returns
 */
export async function getUser(request: Request) {
  const sessionUser = await getSessionUser(request)
  if (sessionUser === undefined) throw redirect('/login')
  return sessionUser
}
export async function getAdminUser(request: Request) {
  const sessionUser = await getUser(request)
  if (sessionUser.role !== 'admin') {
    throw redirect('/')
  }
  return sessionUser
}
