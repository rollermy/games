export interface Card {
  color: string
  value: string
}

export interface FlipMaps {
  colorMap: Record<string, string>
  reverseColorMap: Record<string, string>
  valueMap: Record<string, string>
  reverseValueMap: Record<string, string>
}

export interface DosGameState {
  roomCode: string
  deck: Card[]
  discardPile: Card[]
  hands: Card[][]
  numPlayers: number
  currentPlayer: number
  winner: number | null
  isFlipped: boolean
  flipMaps: FlipMaps
  pendingDraw: number
  pendingCardType: string | null
  mustChooseColor: boolean
  chosenWildColor: string | null
  justDrawnCard: Card | null
  justDrawnPlayerIndex: number | null
  lastCardCounts: number[]
  playerNames: string[]
  connected: boolean[]
  disconnectTimers: (ReturnType<typeof setTimeout> | null)[]
  choosingTarget: { playerIndex: number; cardType: 'Gift' | 'FairyGobble' } | null
}

export interface ClientGameState {
  myHand: Card[]
  opponents: { index: number; name: string; cardCount: number; connected: boolean }[]
  discardTop: Card | null
  deckCount: number
  numPlayers: number
  currentPlayer: number
  myIndex: number
  winner: number | null
  isFlipped: boolean
  pendingDraw: number
  pendingCardType: string | null
  mustChooseColor: boolean
  chosenWildColor: string | null
  justDrawnCard: Card | null
  playerNames: string[]
  myName: string
  choosingTarget: boolean
  targetableOpponents: number[]
}

// Client → Server messages
export type ClientMessage =
  | { type: 'playCard'; cardIndex: number }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: string }
  | { type: 'chooseTarget'; targetIndex: number }
  | { type: 'startGame' }

// Server → Client messages
export type ServerMessage =
  | { type: 'state'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'roomInfo'; code: string; hostName: string; status: string }
  | { type: 'lobbyUpdate'; players: { index: number; name: string }[] }
  | { type: 'gameStarted' }
  | { type: 'animation'; event: AnimationEvent }
  | { type: 'playerDisconnected'; playerIndex: number; playerName: string }
  | { type: 'playerReconnected'; playerIndex: number; playerName: string }
  | { type: 'gameOver'; winner: number; winnerName: string }

// Animation events
export type AnimationEvent =
  | { kind: 'cardPlayed'; card: Card }
  | { kind: 'giftPlayed'; recipientIndex: number; giftCard: Card }
  | { kind: 'fairyGobble'; thiefIndex: number; victimIndex: number; stolenCard: Card; stolenCardIndex: number }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCards: Card[][] }
  | { kind: 'victory'; winnerIndex: number; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: number }
  | { kind: 'cardsDrawn'; playerIndex: number; count: number }
