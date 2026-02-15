<script setup lang="ts">
interface Card {
  color: string
  value: string
}

const props = defineProps<{
  cards: Card[]
  isMyHand: boolean
  isMyTurn: boolean
  playableIndices?: number[]
  justDrawnIndex?: number | null
  doomedIndices?: number[]
  hiddenIndices?: number[]
  dataPlayerIndex?: number
}>()

const emit = defineEmits<{
  playCard: [index: number]
}>()
</script>

<template>
  <div class="dos-hand">
    <template v-if="isMyHand">
      <GamesDosCard
        v-for="(card, idx) in cards"
        :key="`${card.color}-${card.value}-${idx}`"
        :card="card"
        :playable="isMyTurn && (playableIndices?.includes(idx) ?? false)"
        :just-drawn="justDrawnIndex === idx"
        :doomed="doomedIndices?.includes(idx) ?? false"
        :hidden="hiddenIndices?.includes(idx) ?? false"
        @click="emit('playCard', idx)"
      />
    </template>
    <template v-else>
      <div v-if="cards.length > 10" class="flex items-center gap-2">
        <GamesDosCard
          v-for="i in Math.min(cards.length, 7)"
          :key="i"
          :card="{ color: '', value: '' }"
          :face-down="true"
          :doomed="doomedIndices?.includes(i - 1) ?? false"
          :hidden="hiddenIndices?.includes(i - 1) ?? false"
        />
        <span class="text-lg font-bold opacity-70">+{{ cards.length - 7 }}</span>
      </div>
      <template v-else>
        <GamesDosCard
          v-for="i in cards.length"
          :key="i"
          :card="{ color: '', value: '' }"
          :face-down="true"
          :doomed="doomedIndices?.includes(i - 1) ?? false"
          :hidden="hiddenIndices?.includes(i - 1) ?? false"
        />
      </template>
    </template>
  </div>
</template>
