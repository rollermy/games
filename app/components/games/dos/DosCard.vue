<script setup lang="ts">
const props = defineProps<{
  card: { color: string; value: string }
  playable?: boolean
  justDrawn?: boolean
  faceDown?: boolean
  doomed?: boolean
  hidden?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const isWild = computed(() => props.card.color === 'wild')
const isWhite = computed(() => props.card.color === 'white')
const isFairyGobble = computed(() => props.card.value === 'Fairy Gobble')
const isHalfCard = computed(() => props.card.value === 'Half it up!')
const hasButterflies = computed(() => !isWild.value && !isWhite.value && props.card.color !== '')
</script>

<template>
  <div
    class="dos-card"
    :class="[
      faceDown ? 'face-down' : card.color,
      { playable: playable && !faceDown, 'just-drawn': justDrawn && !faceDown, 'half-doomed': doomed }
    ]"
    :style="hidden ? { visibility: 'hidden' } : undefined"
    @click="!faceDown && emit('click')"
  >
    <template v-if="!faceDown">
      <span v-if="isFairyGobble" class="card-fairy-gobble-text">Fairy Gobble</span>
      <span v-else-if="isHalfCard" class="card-half-text">Half it up!</span>
      <span v-else class="card-text">{{ card.value }}</span>

      <template v-if="isWild">
        <div class="sparkle" style="top: 70%; left: 30%; animation-delay: 0.5s;" />
        <div class="sparkle" style="top: 20%; left: 70%; animation-delay: 1.5s;" />
        <div class="sparkle" style="top: 45%; left: 60%; animation-delay: 2.5s;" />
      </template>

      <template v-if="hasButterflies">
        <div class="dos-butterfly top-left" :class="card.color" />
        <div class="dos-butterfly top-right" :class="card.color" />
        <div class="dos-butterfly bottom" :class="card.color" />
      </template>
    </template>
    <template v-else>
      <span class="card-text" style="color: #666;">?</span>
    </template>
  </div>
</template>
