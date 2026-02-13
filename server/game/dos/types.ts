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
  hands: [Card[], Card[]]
  currentPlayer: 0 | 1
  winner: 0 | 1 | null
  isFlipped: boolean
  flipMaps: FlipMaps
  pendingDraw: number
  pendingCardType: string | null
  mustChooseColor: boolean
  chosenWildColor: string | null
  justDrawnCard: Card | null
  justDrawnPlayerIndex: 0 | 1 | null
  lastCardCounts: [number, number]
  playerNames: [string, string]
  connected: [boolean, boolean]
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]
}

export interface ClientGameState {
  myHand: Card[]
  opponentCardCount: number
  discardTop: Card | null
  deckCount: number
  currentPlayer: 0 | 1
  myIndex: 0 | 1
  winner: 0 | 1 | null
  isFlipped: boolean
  pendingDraw: number
  pendingCardType: string | null
  mustChooseColor: boolean
  chosenWildColor: string | null
  justDrawnCard: Card | null
  playerNames: [string, string]
  myName: string
  opponentName: string
}

// Client → Server messages
export type ClientMessage =
  | { type: 'playCard'; cardIndex: number }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: string }

// Server → Client messages
export type ServerMessage =
  | { type: 'state'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'roomInfo'; code: string; hostName: string; status: string }
  | { type: 'playerJoined'; guestName: string }
  | { type: 'gameStarted' }
  | { type: 'animation'; event: AnimationEvent }
  | { type: 'opponentDisconnected' }
  | { type: 'opponentReconnected' }
  | { type: 'gameOver'; winner: 0 | 1; winnerName: string }

// Animation events
export type AnimationEvent =
  | { kind: 'cardPlayed'; card: Card }
  | { kind: 'giftPlayed'; recipientIndex: 0 | 1; giftCard: Card }
  | { kind: 'fairyGobble'; thiefIndex: 0 | 1; stolenCard: Card }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCounts: [number, number] }
  | { kind: 'victory'; winnerIndex: 0 | 1; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: 0 | 1 }
  | { kind: 'cardsDrawn'; playerIndex: 0 | 1; count: number }
