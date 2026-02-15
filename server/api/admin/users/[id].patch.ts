export default defineEventHandler(async (event) => {
  await requireSuperadmin(event)

  const id = getRouterParam(event, 'id')
  const { verified } = await readBody(event)

  if (typeof verified !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'verified must be a boolean' })
  }

  const result = await sql`
    UPDATE users SET verified = ${verified}, updated = NOW()
    WHERE id = ${id}
    RETURNING id, email, display_name, verified, superadmin, created
  `

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { user: result[0] }
})
