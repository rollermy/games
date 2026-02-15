import jwt from 'jsonwebtoken'
import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, AnimationEvent } from '../../game/dos/types'
import { getGame, createGame, removeGame, getSanitizedState, saveGameToDb, loadGameFromDb } from '../../game/dos/state'
import { handlePlayCard, handleDraw, handlePass, handleChooseColor, handleChooseTarget } from '../../game/dos/logic'

interface PeerContext {
  roomCode: string
  playerIndex: number
  role: 'host' | 'guest'
  name: string
}

const peerContexts = new Map<string, PeerContext>()
const roomPeers = new Map<string, Map<number, Peer>>()
const roomLobbies = new Map<string, { index: number; name: string }[]>()

function send(peer: Peer, msg: ServerMessage) {
  peer.send(JSON.stringify(msg))
}

function broadcastState(roomCode: string) {
  const game = getGame(roomCode)
  if (!game) return

  const peers = roomPeers.get(roomCode)
  if (!peers) return

  for (const [playerIndex, peer] of peers) {
    const state = getSanitizedState(game, playerIndex)
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

function broadcastLobbyUpdate(roomCode: string) {
  const lobby = roomLobbies.get(roomCode) || []
  broadcastToRoom(roomCode, { type: 'lobbyUpdate', players: lobby })
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
    let playerIndex: number

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

      // Assign player index based on lobby
      const lobby = roomLobbies.get(code) || []
      const existingEntry = lobby.find(p => p.name === playerName)
      if (existingEntry) {
        playerIndex = existingEntry.index
      } else {
        // Check if game is already playing (reconnection scenario for guests)
        const existingGame = getGame(code) || await loadGameFromDb(code)
        if (existingGame) {
          const existingIdx = existingGame.playerNames.indexOf(playerName)
          if (existingIdx >= 0) {
            playerIndex = existingIdx
          } else {
            send(peer, { type: 'error', message: 'Game already in progress' })
            peer.close(4002, 'Game in progress')
            return
          }
        } else {
          if (lobby.length >= 6) {
            send(peer, { type: 'error', message: 'Room is full (max 6 players)' })
            peer.close(4002, 'Room full')
            return
          }
          playerIndex = lobby.length > 0 ? Math.max(...lobby.map(p => p.index)) + 1 : 1
        }
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

    // Handle reconnection to active game (check memory first, then DB)
    const existingGame = getGame(code) || await loadGameFromDb(code)
    if (existingGame) {
      existingGame.connected[playerIndex] = true
      if (existingGame.disconnectTimers[playerIndex]) {
        clearTimeout(existingGame.disconnectTimers[playerIndex]!)
        existingGame.disconnectTimers[playerIndex] = null
      }
      peers.set(playerIndex, peer)

      // Notify all other peers of reconnection
      for (const [idx, p] of peers) {
        if (idx !== playerIndex) {
          send(p, { type: 'playerReconnected', playerIndex, playerName })
        }
      }

      // Send current state
      broadcastState(code)
      return
    }

    peers.set(playerIndex, peer)

    // Initialize or update lobby
    if (!roomLobbies.has(code)) {
      roomLobbies.set(code, [])
    }
    const lobby = roomLobbies.get(code)!
    if (!lobby.find(p => p.index === playerIndex)) {
      lobby.push({ index: playerIndex, name: playerName })
    }

    // Send room info
    const hostUsers = await sql`SELECT display_name FROM users WHERE id = ${room.host_user_id}`
    const hostName = hostUsers[0]?.display_name || 'Host'

    send(peer, {
      type: 'roomInfo',
      code,
      hostName,
      status: room.status
    })

    // Broadcast lobby update to all peers
    broadcastLobbyUpdate(code)
  },

  async message(peer, message) {
    const ctx = peerContexts.get(peer.id)
    if (!ctx) return

    let msg: ClientMessage
    try {
      msg = JSON.parse(message.text())
    } catch {
      send(peer, { type: 'error', message: 'Invalid message format' })
      return
    }

    // Handle startGame before game exists
    if (msg.type === 'startGame') {
      if (ctx.playerIndex !== 0) {
        send(peer, { type: 'error', message: 'Only the host can start the game' })
        return
      }

      const existingGame = getGame(ctx.roomCode)
      if (existingGame) {
        send(peer, { type: 'error', message: 'Game already started' })
        return
      }

      const lobby = roomLobbies.get(ctx.roomCode)
      if (!lobby || lobby.length < 2) {
        send(peer, { type: 'error', message: 'Need at least 2 players to start' })
        return
      }

      // Sort lobby by index to ensure consistent ordering
      lobby.sort((a, b) => a.index - b.index)

      // Reassign contiguous indices (0, 1, 2, ...) to fix gaps from disconnected guests
      const peers = roomPeers.get(ctx.roomCode)
      for (let i = 0; i < lobby.length; i++) {
        const entry = lobby[i]!
        const oldIndex = entry.index
        const newIndex = i
        if (oldIndex !== newIndex) {
          // Update peer context for this player
          for (const [, pctx] of peerContexts) {
            if (pctx.roomCode === ctx.roomCode && pctx.playerIndex === oldIndex) {
              pctx.playerIndex = newIndex
              break
            }
          }
          // Update roomPeers map
          if (peers) {
            const peer = peers.get(oldIndex)
            if (peer) {
              peers.delete(oldIndex)
              peers.set(newIndex, peer)
            }
          }
          entry.index = newIndex
        }
      }

      const playerNames = lobby.map(p => p.name)

      // Create game state
      createGame(ctx.roomCode, playerNames)

      // Update DB
      await sql`UPDATE game_rooms SET status = 'playing', player_names = ${JSON.stringify(playerNames)}, updated_at = now() WHERE code = ${ctx.roomCode}`

      // Save game state to DB
      await saveGameToDb(ctx.roomCode)

      // Broadcast game started
      broadcastToRoom(ctx.roomCode, { type: 'gameStarted' })

      // Send initial state
      broadcastState(ctx.roomCode)

      // Clean up lobby
      roomLobbies.delete(ctx.roomCode)
      return
    }

    const game = getGame(ctx.roomCode)
    if (!game) {
      send(peer, { type: 'error', message: 'Game not found' })
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
      case 'chooseTarget':
        result = handleChooseTarget(game, ctx.playerIndex, msg.targetIndex)
        break
      default:
        send(peer, { type: 'error', message: 'Unknown action' })
        return
    }

    if (result.error) {
      send(peer, { type: 'error', message: result.error })
      return
    }

    // Broadcast animations to all players
    for (const event of result.events) {
      broadcastAnimation(ctx.roomCode, event)
    }

    // Broadcast updated state to each player
    broadcastState(ctx.roomCode)

    // Save state to DB
    await saveGameToDb(ctx.roomCode)

    // Check for game over
    if (game.winner !== null) {
      const winnerName = game.playerNames[game.winner] ?? 'Unknown'
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

      // Notify all remaining peers
      const peers = roomPeers.get(ctx.roomCode)
      if (peers) {
        peers.delete(ctx.playerIndex)
        for (const [, p] of peers) {
          send(p, { type: 'playerDisconnected', playerIndex: ctx.playerIndex, playerName: ctx.name })
        }
      }

      // If all players disconnected, evict from memory (game persists in DB)
      if (game.connected.every(c => !c)) {
        removeGame(ctx.roomCode)
        roomPeers.delete(ctx.roomCode)
      }
    } else {
      // No active game — remove from lobby and peers
      const peers = roomPeers.get(ctx.roomCode)
      if (peers) {
        peers.delete(ctx.playerIndex)
        if (peers.size === 0) {
          roomPeers.delete(ctx.roomCode)
        }
      }

      // Remove from lobby
      const lobby = roomLobbies.get(ctx.roomCode)
      if (lobby) {
        const idx = lobby.findIndex(p => p.index === ctx.playerIndex)
        if (idx >= 0) lobby.splice(idx, 1)
        if (lobby.length === 0) {
          roomLobbies.delete(ctx.roomCode)
        } else {
          broadcastLobbyUpdate(ctx.roomCode)
        }
      }
    }

    peerContexts.delete(peer.id)
  }
})
