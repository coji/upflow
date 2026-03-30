import { TEAM_COOKIE_NAME } from '~/app/libs/team-cookie'

export function getSelectedTeam(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const prefix = `${TEAM_COOKIE_NAME}=`
  const match = cookieHeader.split('; ').find((c) => c.startsWith(prefix))
  if (!match) return null
  return decodeURIComponent(match.split('=')[1] ?? '') || null
}
