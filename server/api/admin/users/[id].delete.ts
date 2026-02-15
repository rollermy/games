export default defineEventHandler(async (event) => {
  const admin = await requireSuperadmin(event)

  const id = getRouterParam(event, 'id')

  if (id === admin.userId) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete yourself' })
  }

  const result = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { success: true }
})
