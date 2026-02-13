import type { ClientGameState } from '../../server/game/dos/types'

type AnimationEvent =
  | { kind: 'cardPlayed'; card: { color: string; value: string } }
  | { kind: 'giftPlayed'; recipientIndex: 0 | 1; giftCard: { color: string; value: string } }
  | { kind: 'fairyGobble'; thiefIndex: 0 | 1; stolenCard: { color: string; value: string } }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCounts: [number, number] }
  | { kind: 'victory'; winnerIndex: 0 | 1; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: 0 | 1 }
  | { kind: 'cardsDrawn'; playerIndex: 0 | 1; count: number }

type ServerMessage =
  | { type: 'state'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'roomInfo'; code: string; hostName: string; status: string }
  | { type: 'playerJoined'; guestName: string }
  | { type: 'gameStarted' }
  | { type: 'animation'; event: AnimationEvent }
  | { type: 'opponentDisconnected' }
  | { type: 'opponentReconnected' }
  | { type: 'gameOver'; winner: 0 | 1; winnerName: string }

export function useGameSocket() {
  const gameState = ref<ClientGameState | null>(null)
  const connected = ref(false)
  const animationQueue = ref<AnimationEvent[]>([])
  const error = ref<string | null>(null)
  const roomInfo = ref<{ code: string; hostName: string; status: string } | null>(null)
  const gameStarted = ref(false)
  const opponentDisconnected = ref(false)
  const gameOver = ref<{ winner: 0 | 1; winnerName: string } | null>(null)
  const guestJoined = ref<string | null>(null)

  let ws: WebSocket | null = null
  let deliberateClose = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let lastConnectArgs: { code: string; role: 'host' | 'guest'; guestName?: string } | null = null

  function connect(code: string, role: 'host' | 'guest', guestName?: string) {
    lastConnectArgs = { code, role, guestName }
    deliberateClose = false
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let url = `${protocol}//${window.location.host}/api/games/ws?code=${code}&role=${role}`
    if (role === 'guest' && guestName) {
      url += `&name=${encodeURIComponent(guestName)}`
    }

    if (ws) { deliberateClose = true; ws.close(); deliberateClose = false }
    ws = new WebSocket(url)

    ws.onopen = () => {
      connected.value = true
      error.value = null
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)

      switch (msg.type) {
        case 'state':
          gameState.value = msg.state
          if (!gameStarted.value) gameStarted.value = true
          break
        case 'error':
          error.value = msg.message
          break
        case 'roomInfo':
          roomInfo.value = { code: msg.code, hostName: msg.hostName, status: msg.status }
          break
        case 'playerJoined':
          guestJoined.value = msg.guestName
          break
        case 'gameStarted':
          gameStarted.value = true
          break
        case 'animation':
          animationQueue.value = [...animationQueue.value, msg.event]
          break
        case 'opponentDisconnected':
          opponentDisconnected.value = true
          break
        case 'opponentReconnected':
          opponentDisconnected.value = false
          break
        case 'gameOver':
          gameOver.value = { winner: msg.winner, winnerName: msg.winnerName }
          break
      }
    }

    ws.onclose = () => {
      connected.value = false
      if (!deliberateClose && lastConnectArgs) {
        reconnectTimer = setTimeout(() => {
          if (lastConnectArgs) {
            connect(lastConnectArgs.code, lastConnectArgs.role, lastConnectArgs.guestName)
          }
        }, 2000)
      }
    }

    ws.onerror = () => {
      connected.value = false
    }
  }

  function send(msg: object) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function playCard(cardIndex: number) {
    send({ type: 'playCard', cardIndex })
  }

  function draw() {
    send({ type: 'draw' })
  }

  function pass() {
    send({ type: 'pass' })
  }

  function chooseColor(color: string) {
    send({ type: 'chooseColor', color })
  }

  function disconnect() {
    deliberateClose = true
    lastConnectArgs = null
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  function shiftAnimation(): AnimationEvent | undefined {
    if (animationQueue.value.length === 0) return undefined
    const [first, ...rest] = animationQueue.value
    animationQueue.value = rest
    return first
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    gameState: readonly(gameState),
    connected: readonly(connected),
    animationQueue: readonly(animationQueue),
    error: readonly(error),
    roomInfo: readonly(roomInfo),
    gameStarted: readonly(gameStarted),
    opponentDisconnected: readonly(opponentDisconnected),
    gameOver: readonly(gameOver),
    guestJoined: readonly(guestJoined),
    connect,
    playCard,
    draw,
    pass,
    chooseColor,
    disconnect,
    shiftAnimation
  }
}
