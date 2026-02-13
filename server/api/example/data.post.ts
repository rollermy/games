// Example: Authenticated POST endpoint with database access
// The base layer auto-imports: requireAuth, sql, createError

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  // Validate input
  if (!body.name || typeof body.name !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name is required'
    })
  }

  // Example database query using the sql template tag
  // This queries the users table - replace with your own tables
  const result = await sql`
    SELECT id, email, display_name, created
    FROM users
    WHERE id = ${user.userId}
  `

  return {
    success: true,
    received: body.name,
    user: result[0]
  }
})
