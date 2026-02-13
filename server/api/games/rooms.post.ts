import { generateRoomCode } from '../../utils/room-code'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  // Generate a unique room code
  let code: string
  let attempts = 0
  do {
    code = generateRoomCode()
    const existing = await sql`SELECT id FROM game_rooms WHERE code = ${code}`
    if (existing.length === 0) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate unique room code' })
  }

  const result = await sql`
    INSERT INTO game_rooms (code, game_type, host_user_id, status)
    VALUES (${code}, 'dos', ${user.userId}, 'waiting')
    RETURNING id, code, status, created_at
  `

  return {
    id: result[0].id,
    code: result[0].code,
    status: result[0].status,
    createdAt: result[0].created_at
  }
})
