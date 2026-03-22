/**
 * Business logic error that is safe to display to the user.
 * Use this for intentional validation errors in mutations
 * (e.g., "Cannot delete yourself", "Member not found").
 *
 * System errors (DB, filesystem, API) should remain as plain Error
 * and will be replaced with a generic message by getErrorMessage().
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}
