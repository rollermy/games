import type { Card, DosGameState, FlipMaps, AnimationEvent } from './types'

const COLORS = ['red', 'yellow', 'green', 'blue']
const FLIPPED_COLORS = ['lavender', 'skyblue', 'teal', 'indigo']

export function createDeck(): Card[] {
  const deck: Card[] = []

  for (const color of COLORS) {
    // One "0" per color
    deck.push({ color, value: '0' })
    // 8 of each 1-9 per color
    for (let i = 1; i <= 9; i++) {
      for (let j = 0; j < 8; j++) {
        deck.push({ color, value: String(i) })
      }
    }
    // 6 Skip per color
    for (let i = 0; i < 6; i++) deck.push({ color, value: 'Skip' })
    // 6 +2 per color
    for (let i = 0; i < 6; i++) deck.push({ color, value: '+2' })
    // 2 +10 per color
    for (let i = 0; i < 2; i++) deck.push({ color, value: '+10' })
    // 1 +30 per color
    deck.push({ color, value: '+30' })
    // 5 Gift per color
    for (let i = 0; i < 5; i++) deck.push({ color, value: 'Gift' })
    // 10 Fairy Gobble per color
    for (let i = 0; i < 10; i++) deck.push({ color, value: 'Fairy Gobble' })
    // 3 Flip per color
    for (let i = 0; i < 3; i++) deck.push({ color, value: 'Flip' })
  }

  // 15 Wild + 15 Wild+4
  for (let i = 0; i < 15; i++) {
    deck.push({ color: 'wild', value: 'Wild' })
    deck.push({ color: 'wild', value: 'Wild+4' })
  }

  // 8 Half it up! (white)
  for (let i = 0; i < 8; i++) {
    deck.push({ color: 'white', value: 'Half it up!' })
  }

  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function initFlipMaps(): FlipMaps {
  const shuffled = shuffle([...FLIPPED_COLORS])

  const colorMap: Record<string, string> = {}
  const reverseColorMap: Record<string, string> = {}
  COLORS.forEach((color, i) => {
    colorMap[color] = shuffled[i]
    reverseColorMap[shuffled[i]] = color
  })

  const valueMap: Record<string, string> = {
    '+2': '+5', '+10': '+20', '+30': '+25',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    'Skip': 'Skip', 'Gift': 'Gift', 'Fairy Gobble': 'Fairy Gobble',
    'Wild': 'Wild', 'Wild+4': 'Wild+4', 'Half it up!': 'Half it up!', 'Flip': 'Flip'
  }
  const reverseValueMap: Record<string, string> = {
    '+5': '+2', '+20': '+10', '+25': '+30',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    'Skip': 'Skip', 'Gift': 'Gift', 'Fairy Gobble': 'Fairy Gobble',
    'Wild': 'Wild', 'Wild+4': 'Wild+4', 'Half it up!': 'Half it up!', 'Flip': 'Flip'
  }

  return { colorMap, reverseColorMap, valueMap, reverseValueMap }
}

function getFlippedCard(card: Card, maps: FlipMaps): Card {
  if (card.color === 'wild') {
    return { color: 'wild', value: maps.valueMap[card.value] || card.value }
  }
  return {
    color: maps.colorMap[card.color] || card.color,
    value: maps.valueMap[card.value] || card.value
  }
}

function getOriginalCard(card: Card, maps: FlipMaps): Card {
  if (card.color === 'wild') {
    return { color: 'wild', value: maps.reverseValueMap[card.value] || card.value }
  }
  return {
    color: maps.reverseColorMap[card.color] || card.color,
    value: maps.reverseValueMap[card.value] || card.value
  }
}

function transformAllCards(state: DosGameState): void {
  const transform = state.isFlipped
    ? (c: Card) => getFlippedCard(c, state.flipMaps)
    : (c: Card) => getOriginalCard(c, state.flipMaps)

  for (let p = 0; p < state.numPlayers; p++) {
    state.hands[p] = state.hands[p].map(transform)
  }
  state.discardPile = state.discardPile.map(transform)
  state.deck = state.deck.map(transform)

  if (state.pendingCardType) {
    if (state.isFlipped) {
      if (state.pendingCardType === '+2') state.pendingCardType = '+5'
      else if (state.pendingCardType === '+10') state.pendingCardType = '+20'
      else if (state.pendingCardType === '+30') state.pendingCardType = '+25'
    } else {
      if (state.pendingCardType === '+5') state.pendingCardType = '+2'
      else if (state.pendingCardType === '+20') state.pendingCardType = '+10'
      else if (state.pendingCardType === '+25') state.pendingCardType = '+30'
    }
  }

  if (state.chosenWildColor && state.chosenWildColor !== 'wild') {
    state.chosenWildColor = state.isFlipped
      ? (state.flipMaps.colorMap[state.chosenWildColor] || state.chosenWildColor)
      : (state.flipMaps.reverseColorMap[state.chosenWildColor] || state.chosenWildColor)
  }

  sortHands(state)
}

export function sortHands(state: DosGameState): void {
  const colorOrder: Record<string, number> = state.isFlipped
    ? { wild: 0, white: 1, lavender: 2, skyblue: 3, teal: 4, indigo: 5 }
    : { wild: 0, white: 1, red: 2, yellow: 3, green: 4, blue: 5 }

  const specialOrder: Record<string, number> = {
    'Wild': 1, 'Wild+4': 2,
    'Skip': 3,
    '+2': 4, '+5': 4,
    '+10': 5, '+20': 5,
    '+30': 6, '+25': 6,
    'Flip': 7,
    'Gift': 8,
    'Fairy Gobble': 9,
    'Half it up!': 10
  }

  const sortCards = (a: Card, b: Card) => {
    if (a.color !== b.color) {
      return (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99)
    }
    const aNum = parseInt(a.value)
    const bNum = parseInt(b.value)
    const aIsNum = !isNaN(aNum)
    const bIsNum = !isNaN(bNum)
    if (aIsNum && bIsNum) return aNum - bNum
    if (aIsNum) return -1
    if (bIsNum) return 1
    return (specialOrder[a.value] ?? 99) - (specialOrder[b.value] ?? 99)
  }

  for (let p = 0; p < state.numPlayers; p++) {
    state.hands[p].sort(sortCards)
  }
}

export function createInitialState(roomCode: string, playerNames: string[]): DosGameState {
  const numPlayers = playerNames.length
  const flipMaps = initFlipMaps()
  const deck = shuffle(createDeck())

  const hands: Card[][] = []
  for (let p = 0; p < numPlayers; p++) {
    hands.push([])
  }
  for (let i = 0; i < 7; i++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p].push(deck.pop()!)
    }
  }

  // First discard card must be a plain number card (no wilds, specials, or action cards);
  // rejected cards go to the bottom of the deck
  let firstCard = deck.pop()!
  while (firstCard.color === 'wild' || firstCard.color === 'white' || isNaN(parseInt(firstCard.value))) {
    deck.unshift(firstCard)
    firstCard = deck.pop()!
  }
  const discardPile = [firstCard]

  const state: DosGameState = {
    roomCode,
    deck,
    discardPile,
    hands,
    numPlayers,
    currentPlayer: Math.floor(Math.random() * numPlayers),
    winner: null,
    isFlipped: false,
    flipMaps,
    pendingDraw: 0,
    pendingCardType: null,
    mustChooseColor: false,
    chosenWildColor: null,
    justDrawnCard: null,
    justDrawnPlayerIndex: null,
    lastCardCounts: Array(numPlayers).fill(7),
    playerNames: [...playerNames],
    connected: Array(numPlayers).fill(true),
    disconnectTimers: Array(numPlayers).fill(null),
    choosingTarget: null
  }

  sortHands(state)
  return state
}

export function canPlay(state: DosGameState, card: Card): boolean {
  if (state.mustChooseColor) return false
  if (state.choosingTarget) return false

  const top = state.discardPile[state.discardPile.length - 1]

  if (state.pendingDraw > 0 && state.pendingCardType) {
    if (state.pendingCardType === 'Wild+4') {
      return card.value === 'Wild+4'
    }
    if (state.isFlipped) {
      return card.value === state.pendingCardType ||
        (state.pendingCardType === '+5' && card.value === '+5') ||
        (state.pendingCardType === '+20' && card.value === '+20') ||
        (state.pendingCardType === '+25' && card.value === '+25')
    } else {
      return card.value === state.pendingCardType ||
        (state.pendingCardType === '+2' && card.value === '+2') ||
        (state.pendingCardType === '+10' && card.value === '+10') ||
        (state.pendingCardType === '+30' && card.value === '+30')
    }
  }

  if (card.color === 'wild') return true
  if (card.color === 'white') return true
  if (top.color === 'white') return true
  if (top.color === 'wild') {
    // No chosen color for a top wild shouldn't occur in normal play; allow anything so the game can't soft-lock
    return state.chosenWildColor ? card.color === state.chosenWildColor : true
  }
  return card.color === top.color || card.value === top.value
}

function nextPlayer(state: DosGameState): void {
  state.justDrawnCard = null
  state.justDrawnPlayerIndex = null
  state.currentPlayer = (state.currentPlayer + 1) % state.numPlayers
}

function drawCardFromDeck(state: DosGameState, playerIndex: number): Card | null {
  if (state.deck.length === 0) {
    const top = state.discardPile.pop()!
    state.deck = shuffle(state.discardPile)
    state.discardPile = [top]
  }
  if (state.deck.length > 0) {
    const card = state.deck.pop()!
    state.hands[playerIndex].push(card)
    sortHands(state)
    return card
  }
  return null
}

function checkAnnouncements(state: DosGameState): AnimationEvent[] {
  const events: AnimationEvent[] = []
  for (let i = 0; i < state.numPlayers; i++) {
    const currentCount = state.hands[i].length
    if (currentCount !== state.lastCardCounts[i]) {
      if (currentCount === 1 && state.lastCardCounts[i] > 1) {
        events.push({ kind: 'announcement', text: 'Uno!', playerIndex: i })
      } else if (currentCount === 2 && state.lastCardCounts[i] > 2) {
        events.push({ kind: 'announcement', text: 'Dos!', playerIndex: i })
      }
      state.lastCardCounts[i] = currentCount
    }
  }
  return events
}

function checkWinner(state: DosGameState): AnimationEvent[] {
  for (let i = 0; i < state.numPlayers; i++) {
    if (state.hands[i].length === 0) {
      state.winner = i
      return [{ kind: 'victory', winnerIndex: i, winnerName: state.playerNames[i] }]
    }
  }
  return []
}

export function handlePlayCard(state: DosGameState, playerIndex: number, cardIndex: number): { events: AnimationEvent[], error?: string } {
  if (state.winner !== null) return { events: [], error: 'Game is over' }
  if (state.currentPlayer !== playerIndex) return { events: [], error: 'Not your turn' }
  if (state.choosingTarget) return { events: [], error: 'Must choose a target first' }
  if (cardIndex < 0 || cardIndex >= state.hands[playerIndex].length) return { events: [], error: 'Invalid card index' }

  const card = state.hands[playerIndex][cardIndex]
  if (!canPlay(state, card)) return { events: [], error: 'Cannot play this card' }

  const events: AnimationEvent[] = []

  // Reset drawn card state if playing a different card
  if (state.justDrawnCard && card !== state.justDrawnCard) {
    state.justDrawnCard = null
    state.justDrawnPlayerIndex = null
  }

  // Remove from hand, add to discard
  state.hands[playerIndex].splice(cardIndex, 1)
  state.discardPile.push(card)
  state.chosenWildColor = null

  events.push({ kind: 'cardPlayed', card })

  // Handle Flip
  if (card.value === 'Flip') {
    state.isFlipped = !state.isFlipped
    transformAllCards(state)
    events.push({ kind: 'flip', isNowFlipped: state.isFlipped })
    nextPlayer(state)
  }
  // Handle Gift — requires target selection
  else if (card.value === 'Gift') {
    if (state.numPlayers === 2) {
      // Auto-target the only opponent
      const opponentIndex = (playerIndex + 1) % 2
      const colorsToUse = state.isFlipped ? FLIPPED_COLORS : COLORS

      let randomGift: Card
      if (Math.random() < 0.1) {
        randomGift = { color: 'white', value: 'Half it up!' }
      } else {
        const giftOptions: Card[] = [
          { color: 'wild', value: 'Wild' },
          { color: colorsToUse[Math.floor(Math.random() * colorsToUse.length)], value: state.isFlipped ? '+20' : '+10' },
          { color: colorsToUse[Math.floor(Math.random() * colorsToUse.length)], value: state.isFlipped ? '+5' : '+2' }
        ]
        randomGift = giftOptions[Math.floor(Math.random() * giftOptions.length)]
      }
      state.hands[opponentIndex].push(randomGift)
      sortHands(state)
      events.push({ kind: 'giftPlayed', recipientIndex: opponentIndex, giftCard: randomGift })
      nextPlayer(state)
    } else {
      state.choosingTarget = { playerIndex, cardType: 'Gift' }
    }
  }
  // Handle Fairy Gobble — requires target selection
  else if (card.value === 'Fairy Gobble') {
    if (state.numPlayers === 2) {
      const opponentIndex = (playerIndex + 1) % 2
      if (state.hands[opponentIndex].length > 0) {
        const randomIdx = Math.floor(Math.random() * state.hands[opponentIndex].length)
        const stolenCard = state.hands[opponentIndex].splice(randomIdx, 1)[0]
        events.push({ kind: 'fairyGobble', thiefIndex: playerIndex, victimIndex: opponentIndex, stolenCard, stolenCardIndex: randomIdx })
      }
      nextPlayer(state)
    } else {
      // Check if any opponent has cards to steal
      const hasTargets = state.hands.some((hand, i) => i !== playerIndex && hand.length > 0)
      if (hasTargets) {
        state.choosingTarget = { playerIndex, cardType: 'FairyGobble' }
      } else {
        nextPlayer(state)
      }
    }
  }
  // Handle Half it up!
  else if (card.value === 'Half it up!') {
    const removedCards: Card[][] = []
    for (let p = 0; p < state.numPlayers; p++) {
      const count = Math.floor(state.hands[p].length / 2)
      const indices = shuffle([...Array(state.hands[p].length).keys()])
      const toRemove = indices.slice(0, count).sort((a, b) => b - a)
      const removed: Card[] = toRemove.map(idx => state.hands[p][idx])
      for (const idx of toRemove) state.hands[p].splice(idx, 1)
      removedCards.push(removed)
    }

    sortHands(state)
    events.push({ kind: 'halfItUp', removedCards })

    if (card === state.justDrawnCard) {
      state.justDrawnCard = null
      state.justDrawnPlayerIndex = null
    }
    nextPlayer(state)
  }
  // Handle Wild cards
  else if (card.color === 'wild') {
    state.mustChooseColor = true
    state.chosenWildColor = null

    if (card.value === 'Wild+4') {
      if (state.pendingCardType === 'Wild+4') {
        state.pendingDraw += 4
      } else {
        state.pendingDraw = 4
        state.pendingCardType = 'Wild+4'
      }
    }
    // Don't call nextPlayer yet — wait for color choice
  }
  // Handle +2/+5
  else if (card.value === '+2' || card.value === '+5') {
    const drawValue = card.value === '+2' ? 2 : 5
    if (state.pendingCardType === '+2' || state.pendingCardType === '+5') {
      state.pendingDraw += drawValue
    } else {
      state.pendingDraw = drawValue
      state.pendingCardType = card.value
    }
    nextPlayer(state)
  }
  // Handle +10/+20
  else if (card.value === '+10' || card.value === '+20') {
    const drawValue = card.value === '+10' ? 10 : 20
    if (state.pendingCardType === '+10' || state.pendingCardType === '+20') {
      state.pendingDraw += drawValue
    } else {
      state.pendingDraw = drawValue
      state.pendingCardType = card.value
    }
    nextPlayer(state)
  }
  // Handle +30/+25
  else if (card.value === '+30' || card.value === '+25') {
    const drawValue = card.value === '+30' ? 30 : 25
    if (state.pendingCardType === '+30' || state.pendingCardType === '+25') {
      state.pendingDraw += drawValue
    } else {
      state.pendingDraw = drawValue
      state.pendingCardType = card.value
    }
    nextPlayer(state)
  }
  // Handle Skip — skip the next player
  else if (card.value === 'Skip') {
    state.justDrawnCard = null
    state.justDrawnPlayerIndex = null
    // Skip advances past the next player
    nextPlayer(state)
    nextPlayer(state)
  }
  // Regular card
  else {
    state.pendingDraw = 0
    state.pendingCardType = null
    nextPlayer(state)
  }

  if (card === state.justDrawnCard) {
    state.justDrawnCard = null
    state.justDrawnPlayerIndex = null
  }

  events.push(...checkAnnouncements(state))
  events.push(...checkWinner(state))

  return { events }
}

export function handleDraw(state: DosGameState, playerIndex: number): { events: AnimationEvent[], error?: string } {
  if (state.winner !== null) return { events: [], error: 'Game is over' }
  if (state.currentPlayer !== playerIndex) return { events: [], error: 'Not your turn' }
  if (state.mustChooseColor) return { events: [], error: 'Must choose a color first' }
  if (state.choosingTarget) return { events: [], error: 'Must choose a target first' }

  const events: AnimationEvent[] = []

  if (state.pendingDraw > 0) {
    const count = state.pendingDraw
    for (let i = 0; i < count; i++) {
      drawCardFromDeck(state, playerIndex)
    }
    state.pendingDraw = 0
    state.pendingCardType = null
    state.justDrawnCard = null
    state.justDrawnPlayerIndex = null
    events.push({ kind: 'cardsDrawn', playerIndex, count })
  } else {
    const drawn = drawCardFromDeck(state, playerIndex)
    if (drawn) {
      events.push({ kind: 'cardsDrawn', playerIndex, count: 1 })
      state.justDrawnCard = drawn
      state.justDrawnPlayerIndex = playerIndex
    }
  }

  events.push(...checkAnnouncements(state))
  return { events }
}

export function handlePass(state: DosGameState, playerIndex: number): { events: AnimationEvent[], error?: string } {
  if (state.winner !== null) return { events: [], error: 'Game is over' }
  if (state.currentPlayer !== playerIndex) return { events: [], error: 'Not your turn' }

  state.justDrawnCard = null
  state.justDrawnPlayerIndex = null
  nextPlayer(state)

  return { events: [] }
}

export function handleChooseColor(state: DosGameState, playerIndex: number, color: string): { events: AnimationEvent[], error?: string } {
  if (state.winner !== null) return { events: [], error: 'Game is over' }
  if (state.currentPlayer !== playerIndex) return { events: [], error: 'Not your turn' }
  if (!state.mustChooseColor) return { events: [], error: 'Not choosing a color' }

  const validColors = state.isFlipped ? FLIPPED_COLORS : COLORS
  if (!validColors.includes(color)) return { events: [], error: 'Invalid color' }

  state.chosenWildColor = color
  state.mustChooseColor = false
  state.justDrawnCard = null
  state.justDrawnPlayerIndex = null

  const last = state.discardPile[state.discardPile.length - 1]
  if (last.value === 'Wild+4') {
    if (state.pendingCardType !== 'Wild+4') {
      state.pendingDraw = 4
      state.pendingCardType = 'Wild+4'
    }
  }

  nextPlayer(state)

  const events: AnimationEvent[] = []
  events.push(...checkWinner(state))
  return { events }
}

export function handleChooseTarget(state: DosGameState, playerIndex: number, targetIndex: number): { events: AnimationEvent[], error?: string } {
  if (!state.choosingTarget) return { events: [], error: 'Not choosing a target' }
  if (state.choosingTarget.playerIndex !== playerIndex) return { events: [], error: 'Not your turn to choose' }
  if (targetIndex === playerIndex) return { events: [], error: 'Cannot target yourself' }
  if (targetIndex < 0 || targetIndex >= state.numPlayers) return { events: [], error: 'Invalid target' }

  const events: AnimationEvent[] = []
  const { cardType } = state.choosingTarget

  if (cardType === 'Gift') {
    const colorsToUse = state.isFlipped ? FLIPPED_COLORS : COLORS
    let randomGift: Card
    if (Math.random() < 0.1) {
      randomGift = { color: 'white', value: 'Half it up!' }
    } else {
      const giftOptions: Card[] = [
        { color: 'wild', value: 'Wild' },
        { color: colorsToUse[Math.floor(Math.random() * colorsToUse.length)], value: state.isFlipped ? '+20' : '+10' },
        { color: colorsToUse[Math.floor(Math.random() * colorsToUse.length)], value: state.isFlipped ? '+5' : '+2' }
      ]
      randomGift = giftOptions[Math.floor(Math.random() * giftOptions.length)]
    }
    state.hands[targetIndex].push(randomGift)
    sortHands(state)
    events.push({ kind: 'giftPlayed', recipientIndex: targetIndex, giftCard: randomGift })
  } else if (cardType === 'FairyGobble') {
    if (state.hands[targetIndex].length > 0) {
      const randomIdx = Math.floor(Math.random() * state.hands[targetIndex].length)
      const stolenCard = state.hands[targetIndex].splice(randomIdx, 1)[0]
      events.push({ kind: 'fairyGobble', thiefIndex: playerIndex, victimIndex: targetIndex, stolenCard, stolenCardIndex: randomIdx })
    }
  }

  state.choosingTarget = null
  nextPlayer(state)

  events.push(...checkAnnouncements(state))
  events.push(...checkWinner(state))

  return { events }
}
