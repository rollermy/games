import type { ClientGameState } from '../../server/game/dos/types'

type AnimationEvent =
  | { kind: 'cardPlayed'; card: { color: string; value: string } }
  | { kind: 'giftPlayed'; recipientIndex: number; giftCard: { color: string; value: string } }
  | { kind: 'fairyGobble'; thiefIndex: number; victimIndex: number; stolenCard: { color: string; value: string }; stolenCardIndex: number }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCards: { color: string; value: string }[][] }
  | { kind: 'victory'; winnerIndex: number; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: number }
  | { kind: 'cardsDrawn'; playerIndex: number; count: number }

type ServerMessage =
  | { type: 'state'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'roomInfo'; code: string; hostName: string; status: string }
  | { type: 'lobbyUpdate'; players: { index: number; name: string }[] }
  | { type: 'gameStarted' }
  | { type: 'animation'; event: AnimationEvent }
  | { type: 'playerDisconnected'; playerIndex: number; playerName: string }
  | { type: 'playerReconnected'; playerIndex: number; playerName: string }
  | { type: 'gameOver'; winner: number; winnerName: string }

export function useGameSocket() {
  const gameState = ref<ClientGameState | null>(null)
  const connected = ref(false)
  const animationQueue = ref<AnimationEvent[]>([])
  const error = ref<string | null>(null)
  const roomInfo = ref<{ code: string; hostName: string; status: string } | null>(null)
  const gameStarted = ref(false)
  const disconnectedPlayers = ref<Set<number>>(new Set())
  const gameOver = ref<{ winner: number; winnerName: string } | null>(null)
  const lobbyPlayers = ref<{ index: number; name: string }[]>([])

  // Defer state updates while a half-it-up animation is pending/playing
  let deferredState: ClientGameState | null = null
  let deferringState = false

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
          if (deferringState) {
            deferredState = msg.state
          } else {
            gameState.value = msg.state
          }
          if (!gameStarted.value) gameStarted.value = true
          break
        case 'error':
          error.value = msg.message
          break
        case 'roomInfo':
          roomInfo.value = { code: msg.code, hostName: msg.hostName, status: msg.status }
          break
        case 'lobbyUpdate':
          lobbyPlayers.value = msg.players
          break
        case 'gameStarted':
          gameStarted.value = true
          gameOver.value = null
          break
        case 'animation':
          if (msg.event.kind === 'halfItUp' || msg.event.kind === 'fairyGobble') {
            deferringState = true
            deferredState = null
          }
          animationQueue.value = [...animationQueue.value, msg.event]
          break
        case 'playerDisconnected':
          disconnectedPlayers.value = new Set([...disconnectedPlayers.value, msg.playerIndex])
          break
        case 'playerReconnected':
          disconnectedPlayers.value = new Set([...disconnectedPlayers.value].filter(i => i !== msg.playerIndex))
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

  function startGame() {
    send({ type: 'startGame' })
  }

  function chooseTarget(targetIndex: number) {
    send({ type: 'chooseTarget', targetIndex })
  }

  function playAgain() {
    send({ type: 'playAgain' })
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

  function flushDeferredState() {
    deferringState = false
    if (deferredState) {
      gameState.value = deferredState
      deferredState = null
    }
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
    disconnectedPlayers: readonly(disconnectedPlayers),
    gameOver: readonly(gameOver),
    lobbyPlayers: readonly(lobbyPlayers),
    connect,
    playCard,
    draw,
    pass,
    chooseColor,
    startGame,
    chooseTarget,
    playAgain,
    disconnect,
    shiftAnimation,
    flushDeferredState
  }
}
