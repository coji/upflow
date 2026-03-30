import { TEAM_COOKIE_NAME } from '~/app/libs/team-cookie'

export function getSelectedTeam(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const prefix = `${TEAM_COOKIE_NAME}=`
  const match = cookieHeader.split('; ').find((c) => c.startsWith(prefix))
  if (!match) return null
  const rawValue = match.slice(prefix.length)
  try {
    return decodeURIComponent(rawValue) || null
  } catch {
    return null
  }
}
