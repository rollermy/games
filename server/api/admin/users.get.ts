export default defineEventHandler(async (event) => {
  await requireSuperadmin(event)

  const users = await sql`
    SELECT id, email, display_name, verified, superadmin, created
    FROM users
    ORDER BY created DESC
  `

  return { users }
})
