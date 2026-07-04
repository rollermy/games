<script setup lang="ts">
interface Card {
  color: string
  value: string
}

interface Opponent {
  index: number
  name: string
  cardCount: number
  connected: boolean
}

interface ClientGameState {
  myHand: Card[]
  opponents: Opponent[]
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

const props = defineProps<{
  state: ClientGameState
}>()

const emit = defineEmits<{
  playCard: [index: number]
  draw: []
  pass: []
  chooseColor: [color: string]
  chooseTarget: [targetIndex: number]
}>()

const doomedMyIndices = inject<Ref<number[]>>('doomedMyIndices', ref([]))
const hiddenMyIndices = inject<Ref<number[]>>('hiddenMyIndices', ref([]))
const doomedOpponentMap = inject<Ref<Record<number, number[]>>>('doomedOpponentMap', ref({}))
const hiddenOpponentMap = inject<Ref<Record<number, number[]>>>('hiddenOpponentMap', ref({}))

const isMyTurn = computed(() => props.state.currentPlayer === props.state.myIndex)

const canDraw = computed(() =>
  isMyTurn.value && !props.state.mustChooseColor && !props.state.choosingTarget && props.state.winner === null
)

const showPassBtn = computed(() =>
  isMyTurn.value && props.state.justDrawnCard !== null && props.state.pendingDraw === 0
)

const drawBtnText = computed(() => {
  if (props.state.pendingDraw > 0) return `Draw ${props.state.pendingDraw} Cards`
  return 'Draw Card'
})

const mustDraw = computed(() => props.state.pendingDraw > 0)

// Determine which cards in hand are playable
const playableIndices = computed(() => {
  if (!isMyTurn.value || props.state.mustChooseColor || props.state.choosingTarget || props.state.winner !== null) return []

  const top = props.state.discardTop
  if (!top) return []

  return props.state.myHand
    .map((card, idx) => {
      if (canPlayCard(card, top)) return idx
      return -1
    })
    .filter(idx => idx >= 0)
})

const justDrawnIndex = computed(() => {
  if (!props.state.justDrawnCard) return null
  const jd = props.state.justDrawnCard
  for (let i = props.state.myHand.length - 1; i >= 0; i--) {
    const c = props.state.myHand[i]
    if (c.color === jd.color && c.value === jd.value) return i
  }
  return null
})

function canPlayCard(card: Card, top: Card): boolean {
  if (props.state.mustChooseColor) return false
  if (props.state.choosingTarget) return false

  if (props.state.pendingDraw > 0 && props.state.pendingCardType) {
    if (props.state.pendingCardType === 'Wild+4') {
      return card.value === 'Wild+4'
    }
    return card.value === props.state.pendingCardType
  }

  if (card.color === 'wild') return true
  if (card.color === 'white') return true
  if (top.color === 'white') return true
  if (top.color === 'wild') {
    // No chosen color for a top wild shouldn't occur in normal play; allow anything so the game can't soft-lock
    return props.state.chosenWildColor ? card.color === props.state.chosenWildColor : true
  }
  return card.color === top.color || card.value === top.value
}

const currentTurnName = computed(() => {
  return props.state.playerNames[props.state.currentPlayer] || ''
})

const statusText = computed(() => {
  if (props.state.winner !== null) return ''
  const turnText = isMyTurn.value ? 'Your turn' : `${currentTurnName.value}'s turn`

  if (props.state.choosingTarget && isMyTurn.value) return `${turnText} — Choose a target`
  if (props.state.mustChooseColor) return `${turnText} — Choose a color`
  if (props.state.pendingDraw > 0 && isMyTurn.value) {
    const cardType = props.state.pendingCardType === 'Wild+4' ? '+4' : props.state.pendingCardType
    return `${turnText} — Draw ${props.state.pendingDraw} cards or play a ${cardType}`
  }
  if (props.state.justDrawnCard && isMyTurn.value) {
    return `${turnText} — You drew a card. Play it or pass.`
  }
  if (props.state.chosenWildColor) {
    return `${turnText} — Active color: ${props.state.chosenWildColor}`
  }
  return turnText
})

// Auto-pass for unplayable drawn card
const autoPassTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(() => props.state.justDrawnCard, (jd) => {
  if (autoPassTimer.value) {
    clearTimeout(autoPassTimer.value)
    autoPassTimer.value = null
  }
  if (jd && isMyTurn.value && props.state.discardTop) {
    if (!canPlayCard(jd, props.state.discardTop)) {
      autoPassTimer.value = setTimeout(() => {
        emit('pass')
      }, 1500)
    }
  }
})

onUnmounted(() => {
  if (autoPassTimer.value) clearTimeout(autoPassTimer.value)
})

function getColorHex(color: string): string {
  const map: Record<string, string> = {
    red: '#e53935', yellow: '#fbc02d', green: '#43a047', blue: '#1e88e5',
    lavender: '#9c64a6', skyblue: '#48c9b0', teal: '#00897b', indigo: '#1a237e'
  }
  return map[color] || '#888'
}

function needsDarkText(color: string): boolean {
  return ['yellow', 'skyblue'].includes(color)
}
</script>

<template>
  <div class="dos-board">
    <!-- Opponents row -->
    <div class="dos-opponents-row">
      <div
        v-for="opp in state.opponents"
        :key="opp.index"
        class="dos-opponent-area"
        :data-player-index="opp.index"
        :class="{ 'is-current-turn': state.currentPlayer === opp.index, 'is-disconnected': !opp.connected }"
      >
        <div class="dos-player-info">
          <span>
            {{ opp.name }}
            <span v-if="!opp.connected" class="dos-disconnected-badge">DC</span>
          </span>
          <span class="dos-card-count">{{ opp.cardCount }}</span>
        </div>
        <GamesDosHand
          :cards="Array(opp.cardCount).fill({ color: '', value: '' })"
          :is-my-hand="false"
          :is-my-turn="false"
          :doomed-indices="doomedOpponentMap[opp.index] || []"
          :hidden-indices="hiddenOpponentMap[opp.index] || []"
          :data-player-index="opp.index"
        />
      </div>
    </div>

    <!-- Status bar -->
    <div class="dos-status-bar">
      <span>{{ statusText }}</span>
      <span v-if="state.isFlipped" style="color: gold; margin-left: 8px; text-shadow: 0 0 5px gold;">
        FLIPPED!
      </span>
    </div>

    <!-- Center: discard + draw piles -->
    <div class="dos-center-area">
      <!-- Discard pile -->
      <div class="dos-pile">
        <span class="dos-pile-label">Discard</span>
        <GamesDosCard v-if="state.discardTop" :card="state.discardTop" />
        <div v-if="state.chosenWildColor && state.discardTop?.color === 'wild'" class="mt-1 text-center">
          <span
            class="inline-block px-2 py-1 rounded font-bold text-sm"
            :style="{ background: getColorHex(state.chosenWildColor), color: needsDarkText(state.chosenWildColor) ? '#222' : '#fff' }"
          >
            {{ state.chosenWildColor }}
          </span>
        </div>
      </div>

      <!-- Draw pile + buttons -->
      <div class="dos-pile">
        <span class="dos-pile-label">Deck ({{ state.deckCount }})</span>
        <GamesDosCard :card="{ color: '', value: String(state.deckCount) }" :face-down="true" />
        <div class="flex gap-2 mt-2">
          <button
            class="dos-draw-btn"
            :class="{ 'must-draw': mustDraw && isMyTurn }"
            :disabled="!canDraw"
            @click="emit('draw')"
          >
            {{ drawBtnText }}
          </button>
          <button
            v-if="showPassBtn"
            class="dos-pass-btn"
            @click="emit('pass')"
          >
            Pass
          </button>
        </div>
      </div>
    </div>

    <!-- Color picker overlay -->
    <div v-if="state.mustChooseColor && isMyTurn" class="py-4">
      <p class="text-center font-bold mb-2">Choose a color:</p>
      <GamesDosColorPicker :is-flipped="state.isFlipped" @choose="emit('chooseColor', $event)" />
    </div>

    <!-- Target chooser overlay -->
    <div v-if="state.choosingTarget && isMyTurn" class="dos-target-chooser">
      <p class="text-center font-bold mb-4 text-xl">Choose a target:</p>
      <div class="dos-target-buttons">
        <button
          v-for="targetIdx in state.targetableOpponents"
          :key="targetIdx"
          class="dos-target-btn"
          @click="emit('chooseTarget', targetIdx)"
        >
          {{ state.playerNames[targetIdx] }}
        </button>
      </div>
    </div>

    <!-- My hand -->
    <div class="dos-my-area" :class="{ 'my-turn': isMyTurn }">
      <div class="dos-player-info">
        <span>{{ state.myName }} (You)</span>
        <span class="dos-card-count">{{ state.myHand.length }}</span>
      </div>
      <GamesDosHand
        :cards="state.myHand"
        :is-my-hand="true"
        :is-my-turn="isMyTurn"
        :playable-indices="playableIndices"
        :just-drawn-index="justDrawnIndex"
        :doomed-indices="doomedMyIndices"
        :hidden-indices="hiddenMyIndices"
        @play-card="emit('playCard', $event)"
      />
    </div>
  </div>
</template>
