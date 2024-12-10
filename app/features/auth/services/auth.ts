import { createCookieSessionStorage, redirect } from 'react-router'
import type { SessionUser } from '../types/types'

const SESSION_KEY = 'user'
export const sessionStorage = createCookieSessionStorage<{
  [SESSION_KEY]: SessionUser
}>({
  cookie: {
    name: '__session__',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
  },
})

/**
 * リクエストに含まれるCookieからセッション情報を取得する
 * @param request
 * @returns
 */
export async function getSession(request: Request) {
  return await sessionStorage.getSession(request.headers.get('Cookie'))
}

/**
 * リクエストに含まれるCookieからセッションを取得し、中に含まれるユーザ情報を取得する
 * @param request
 * @returns
 */
export async function getSessionUser(request: Request) {
  const session = await getSession(request)
  return session?.get(SESSION_KEY)
}

/**
 * セッション情報を保存し、Cookieを返す
 * @param request
 * @param user
 * @returns
 */
export async function saveSession(request: Request, user: SessionUser) {
  const session = await getSession(request)
  session.set(SESSION_KEY, user)

  return new Headers({
    'Set-Cookie': await sessionStorage.commitSession(session),
  })
}

/**
 * 認証ユーザガード
 * @param request
 * @returns
 */
export const requireUser = async (request: Request) => {
  const sessionUser = await getSessionUser(request)
  if (sessionUser === undefined) throw redirect('/login')
  return sessionUser
}

/**
 * 管理者ユーザガード
 * @param request
 * @returns
 */
export const requireAdminUser = async (request: Request) => {
  const sessionUser = await requireUser(request)
  if (sessionUser?.role !== 'admin') throw redirect('/')
  return sessionUser
}
