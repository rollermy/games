import type { DosGameState, ClientGameState, Card } from './types'
import { createInitialState, canPlay } from './logic'

const activeGames = new Map<string, DosGameState>()

export function getGame(code: string): DosGameState | undefined {
  return activeGames.get(code)
}

export function createGame(code: string, hostName: string, guestName: string): DosGameState {
  const state = createInitialState(code, hostName, guestName)
  activeGames.set(code, state)
  return state
}

export function removeGame(code: string): void {
  activeGames.delete(code)
}

export function getSanitizedState(state: DosGameState, playerIndex: 0 | 1): ClientGameState {
  const opponentIndex = ((playerIndex + 1) % 2) as 0 | 1
  const top = state.discardPile[state.discardPile.length - 1] || null

  // Only show justDrawnCard if it belongs to this player
  let justDrawnCard: Card | null = null
  if (state.justDrawnCard && state.justDrawnPlayerIndex === playerIndex) {
    justDrawnCard = state.justDrawnCard
  }

  // Determine which cards are playable for highlighting
  const myHand = state.hands[playerIndex].map(card => ({ ...card }))

  return {
    myHand,
    opponentCardCount: state.hands[opponentIndex].length,
    discardTop: top ? { ...top } : null,
    deckCount: state.deck.length,
    currentPlayer: state.currentPlayer,
    myIndex: playerIndex,
    winner: state.winner,
    isFlipped: state.isFlipped,
    pendingDraw: state.pendingDraw,
    pendingCardType: state.pendingCardType,
    mustChooseColor: state.mustChooseColor,
    chosenWildColor: state.chosenWildColor,
    justDrawnCard,
    playerNames: [...state.playerNames] as [string, string],
    myName: state.playerNames[playerIndex],
    opponentName: state.playerNames[opponentIndex]
  }
}

export function canPlayCard(state: DosGameState, card: Card): boolean {
  return canPlay(state, card)
}
