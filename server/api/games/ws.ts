import jwt from 'jsonwebtoken'
import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, AnimationEvent } from '../../game/dos/types'
import { getGame, createGame, removeGame, getSanitizedState } from '../../game/dos/state'
import { handlePlayCard, handleDraw, handlePass, handleChooseColor } from '../../game/dos/logic'

interface PeerContext {
  roomCode: string
  playerIndex: 0 | 1
  role: 'host' | 'guest'
  name: string
}

const peerContexts = new Map<string, PeerContext>()
const roomPeers = new Map<string, Map<number, Peer>>()

function send(peer: Peer, msg: ServerMessage) {
  peer.send(JSON.stringify(msg))
}

function broadcastState(roomCode: string) {
  const game = getGame(roomCode)
  if (!game) return

  const peers = roomPeers.get(roomCode)
  if (!peers) return

  for (const [playerIndex, peer] of peers) {
    const state = getSanitizedState(game, playerIndex as 0 | 1)
    send(peer, { type: 'state', state })
  }
}

function broadcastAnimation(roomCode: string, event: AnimationEvent) {
  const peers = roomPeers.get(roomCode)
  if (!peers) return

  for (const [, peer] of peers) {
    send(peer, { type: 'animation', event })
  }
}

function broadcastToRoom(roomCode: string, msg: ServerMessage) {
  const peers = roomPeers.get(roomCode)
  if (!peers) return

  for (const [, peer] of peers) {
    send(peer, msg)
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    const url = new URL(peer.request?.url || '', 'http://localhost')
    const code = url.searchParams.get('code')?.toUpperCase()
    const role = url.searchParams.get('role') as 'host' | 'guest'
    const guestName = url.searchParams.get('name')

    if (!code || !role) {
      send(peer, { type: 'error', message: 'Missing code or role' })
      peer.close(4000, 'Missing code or role')
      return
    }

    // Validate room exists
    const rooms = await sql`SELECT * FROM game_rooms WHERE code = ${code}`
    if (rooms.length === 0) {
      send(peer, { type: 'error', message: 'Room not found' })
      peer.close(4004, 'Room not found')
      return
    }
    const room = rooms[0]

    let playerName: string
    let playerIndex: 0 | 1

    if (role === 'host') {
      // Validate JWT from cookie
      const cookieHeader = peer.request?.headers?.get('cookie') || ''
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const [key, ...val] = c.trim().split('=')
          return [key, val.join('=')]
        }).filter(([k]) => k)
      )
      const token = cookies['auth-token']

      if (!token) {
        send(peer, { type: 'error', message: 'Authentication required' })
        peer.close(4001, 'Auth required')
        return
      }

      try {
        const payload = jwt.verify(token, useRuntimeConfig().jwtSecret) as { userId: string; display_name: string }
        if (payload.userId !== room.host_user_id) {
          send(peer, { type: 'error', message: 'Not the host of this room' })
          peer.close(4003, 'Not host')
          return
        }
        playerName = payload.display_name || 'Host'
      } catch {
        send(peer, { type: 'error', message: 'Invalid auth token' })
        peer.close(4001, 'Invalid token')
        return
      }

      playerIndex = 0
    } else {
      // Guest
      if (room.status !== 'waiting' && room.status !== 'playing') {
        send(peer, { type: 'error', message: 'Room is not available' })
        peer.close(4002, 'Room not available')
        return
      }

      playerName = guestName || 'Guest'
      playerIndex = 1

      // Update guest name in DB
      if (room.status === 'waiting') {
        await sql`UPDATE game_rooms SET guest_name = ${playerName}, updated_at = now() WHERE code = ${code}`
      }
    }

    // Store peer context
    const ctx: PeerContext = { roomCode: code, playerIndex, role, name: playerName }
    peerContexts.set(peer.id, ctx)

    // Add to room peers
    if (!roomPeers.has(code)) {
      roomPeers.set(code, new Map())
    }
    const peers = roomPeers.get(code)!

    // Handle reconnection
    const existingGame = getGame(code)
    if (existingGame) {
      existingGame.connected[playerIndex] = true
      if (existingGame.disconnectTimers[playerIndex]) {
        clearTimeout(existingGame.disconnectTimers[playerIndex]!)
        existingGame.disconnectTimers[playerIndex] = null
      }
      peers.set(playerIndex, peer)

      // Notify opponent of reconnection
      const opponentPeer = peers.get(playerIndex === 0 ? 1 : 0)
      if (opponentPeer) {
        send(opponentPeer, { type: 'opponentReconnected' })
      }

      // Send current state
      broadcastState(code)
      return
    }

    peers.set(playerIndex, peer)

    // Send room info
    const hostUsers = await sql`SELECT display_name FROM users WHERE id = ${room.host_user_id}`
    const hostName = hostUsers[0]?.display_name || 'Host'

    send(peer, {
      type: 'roomInfo',
      code,
      hostName,
      status: room.status
    })

    // Check if both players are connected and game hasn't started
    if (peers.size === 2 && room.status === 'waiting') {
      const hostPeer = peers.get(0)
      const guestPeer = peers.get(1)
      const hostCtx = [...peerContexts.values()].find(c => c.roomCode === code && c.playerIndex === 0)
      const guestCtx = [...peerContexts.values()].find(c => c.roomCode === code && c.playerIndex === 1)

      if (hostPeer && guestPeer && hostCtx && guestCtx) {
        // Notify host that guest joined
        send(hostPeer, { type: 'playerJoined', guestName: guestCtx.name })

        // Create game state
        createGame(code, hostCtx.name, guestCtx.name)

        // Update DB
        await sql`UPDATE game_rooms SET status = 'playing', updated_at = now() WHERE code = ${code}`

        // Broadcast game started
        broadcastToRoom(code, { type: 'gameStarted' })

        // Send initial state
        broadcastState(code)
      }
    }
  },

  async message(peer, message) {
    const ctx = peerContexts.get(peer.id)
    if (!ctx) return

    const game = getGame(ctx.roomCode)
    if (!game) {
      send(peer, { type: 'error', message: 'Game not found' })
      return
    }

    let msg: ClientMessage
    try {
      msg = JSON.parse(message.text())
    } catch {
      send(peer, { type: 'error', message: 'Invalid message format' })
      return
    }

    let result: { events: AnimationEvent[], error?: string }

    switch (msg.type) {
      case 'playCard':
        result = handlePlayCard(game, ctx.playerIndex, msg.cardIndex)
        break
      case 'draw':
        result = handleDraw(game, ctx.playerIndex)
        break
      case 'pass':
        result = handlePass(game, ctx.playerIndex)
        break
      case 'chooseColor':
        result = handleChooseColor(game, ctx.playerIndex, msg.color)
        break
      default:
        send(peer, { type: 'error', message: 'Unknown action' })
        return
    }

    if (result.error) {
      send(peer, { type: 'error', message: result.error })
      return
    }

    // Broadcast animations to both players
    for (const event of result.events) {
      broadcastAnimation(ctx.roomCode, event)
    }

    // Broadcast updated state to each player
    broadcastState(ctx.roomCode)

    // Check for game over
    if (game.winner !== null) {
      const winnerName = game.playerNames[game.winner]
      broadcastToRoom(ctx.roomCode, { type: 'gameOver', winner: game.winner, winnerName })

      await sql`
        UPDATE game_rooms
        SET status = 'finished', winner = ${winnerName}, updated_at = now()
        WHERE code = ${ctx.roomCode}
      `
    }
  },

  async close(peer) {
    const ctx = peerContexts.get(peer.id)
    if (!ctx) return

    const game = getGame(ctx.roomCode)
    if (game) {
      game.connected[ctx.playerIndex] = false

      // Notify opponent
      const peers = roomPeers.get(ctx.roomCode)
      if (peers) {
        peers.delete(ctx.playerIndex)
        const opponentIndex = ctx.playerIndex === 0 ? 1 : 0
        const opponentPeer = peers.get(opponentIndex)
        if (opponentPeer) {
          send(opponentPeer, { type: 'opponentDisconnected' })
        }
      }

      // Keep game alive for 60s to allow reconnection
      game.disconnectTimers[ctx.playerIndex] = setTimeout(() => {
        const currentGame = getGame(ctx.roomCode)
        if (currentGame && !currentGame.connected[ctx.playerIndex]) {
          // If both disconnected, clean up
          if (!currentGame.connected[0] && !currentGame.connected[1]) {
            removeGame(ctx.roomCode)
            roomPeers.delete(ctx.roomCode)
          }
        }
      }, 60000)
    } else {
      // No active game, clean up peer tracking
      const peers = roomPeers.get(ctx.roomCode)
      if (peers) {
        peers.delete(ctx.playerIndex)
        if (peers.size === 0) {
          roomPeers.delete(ctx.roomCode)
        }
      }
    }

    peerContexts.delete(peer.id)
  }
})
