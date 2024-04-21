import type { DB, Selectable } from '~/app/services/db.server'

export interface SessionUser {
  id: Selectable<DB.User>['id']
  email: Selectable<DB.User>['email']
  displayName: Selectable<DB.User>['displayName']
  pictureUrl: Selectable<DB.User>['pictureUrl']
  locale: Selectable<DB.User>['locale']
  role: Selectable<DB.User>['role']
}
