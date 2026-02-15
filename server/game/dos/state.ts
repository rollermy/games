import type { DosGameState, ClientGameState, Card } from './types'
import { createInitialState, canPlay } from './logic'
import { sql } from '../../utils/database'

const activeGames = new Map<string, DosGameState>()

export function getGame(code: string): DosGameState | undefined {
  return activeGames.get(code)
}

export function createGame(code: string, playerNames: string[]): DosGameState {
  const state = createInitialState(code, playerNames)
  activeGames.set(code, state)
  return state
}

export function removeGame(code: string): void {
  activeGames.delete(code)
}

export function getSanitizedState(state: DosGameState, playerIndex: number): ClientGameState {
  const top = state.discardPile[state.discardPile.length - 1] || null

  // Only show justDrawnCard if it belongs to this player
  let justDrawnCard: Card | null = null
  if (state.justDrawnCard && state.justDrawnPlayerIndex === playerIndex) {
    justDrawnCard = state.justDrawnCard
  }

  const myHand = (state.hands[playerIndex] ?? []).map(card => ({ ...card }))

  // Build opponents array (all players except self)
  const opponents: ClientGameState['opponents'] = []
  for (let i = 0; i < state.numPlayers; i++) {
    if (i === playerIndex) continue
    opponents.push({
      index: i,
      name: state.playerNames[i] ?? 'Unknown',
      cardCount: (state.hands[i] ?? []).length,
      connected: state.connected[i] ?? false
    })
  }

  // Build targetable opponents list when choosing target
  const targetableOpponents: number[] = []
  if (state.choosingTarget && state.choosingTarget.playerIndex === playerIndex) {
    for (let i = 0; i < state.numPlayers; i++) {
      if (i === playerIndex) continue
      if (state.choosingTarget.cardType === 'FairyGobble' && (state.hands[i] ?? []).length === 0) continue
      targetableOpponents.push(i)
    }
  }

  return {
    myHand,
    opponents,
    discardTop: top ? { ...top } : null,
    deckCount: state.deck.length,
    numPlayers: state.numPlayers,
    currentPlayer: state.currentPlayer,
    myIndex: playerIndex,
    winner: state.winner,
    isFlipped: state.isFlipped,
    pendingDraw: state.pendingDraw,
    pendingCardType: state.pendingCardType,
    mustChooseColor: state.mustChooseColor,
    chosenWildColor: state.chosenWildColor,
    justDrawnCard,
    playerNames: [...state.playerNames],
    myName: state.playerNames[playerIndex] ?? 'Unknown',
    choosingTarget: state.choosingTarget?.playerIndex === playerIndex,
    targetableOpponents
  }
}

export function canPlayCard(state: DosGameState, card: Card): boolean {
  return canPlay(state, card)
}

export function serializeState(state: DosGameState): Omit<DosGameState, 'disconnectTimers'> {
  const { disconnectTimers, ...rest } = state
  return rest
}

export function deserializeState(data: any): DosGameState {
  return {
    ...data,
    connected: (data.connected as boolean[]).map(() => false),
    disconnectTimers: (data.connected as boolean[]).map(() => null)
  }
}

export function saveGameToDb(code: string) {
  const game = activeGames.get(code)
  if (!game) return
  const serialized = serializeState(game)
  return sql`UPDATE game_rooms SET game_state = ${JSON.stringify(serialized)}::jsonb, updated_at = now() WHERE code = ${code}`
}

export function loadGameFromDb(code: string) {
  if (activeGames.has(code)) return activeGames.get(code)
  return sql`SELECT game_state FROM game_rooms WHERE code = ${code} AND status = 'playing' AND game_state IS NOT NULL`.then((rows: any[]) => {
    if (rows.length === 0 || !rows[0].game_state) return undefined
    const state = deserializeState(rows[0].game_state)
    activeGames.set(code, state)
    return state
  })
}
