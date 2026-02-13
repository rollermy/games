// Example: Authenticated API endpoint
// The base layer auto-imports: requireAuth, getAuthUser, sql, createError

export default defineEventHandler(async (event) => {
  // requireAuth() throws 401 if not logged in
  // Returns: { userId: string, email: string, display_name: string }
  const user = requireAuth(event)

  return {
    message: `Hello, ${user.display_name || user.email}!`,
    userId: user.userId
  }
})
