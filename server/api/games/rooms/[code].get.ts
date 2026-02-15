export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Room code is required' })
  }

  const rooms = await sql`
    SELECT gr.id, gr.code, gr.game_type, gr.host_user_id, gr.status, gr.guest_name, gr.player_names, gr.created_at,
           u.display_name as host_name
    FROM game_rooms gr
    JOIN users u ON u.id = gr.host_user_id
    WHERE gr.code = ${code.toUpperCase()}
  `

  if (rooms.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Room not found' })
  }

  const room = rooms[0]
  return {
    code: room.code,
    gameType: room.game_type,
    status: room.status,
    hostName: room.host_name,
    hostUserId: room.host_user_id,
    guestName: room.guest_name,
    playerNames: room.player_names || [],
    createdAt: room.created_at
  }
})
