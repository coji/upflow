const COOKIE_NAME = 'selected_team'

export function getSelectedTeam(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const match = cookieHeader
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null
  return decodeURIComponent(match.split('=')[1] ?? '') || null
}
