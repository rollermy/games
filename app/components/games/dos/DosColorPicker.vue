<script setup lang="ts">
const props = defineProps<{
  isFlipped: boolean
}>()

const emit = defineEmits<{
  choose: [color: string]
}>()

const colors = computed(() =>
  props.isFlipped
    ? ['lavender', 'skyblue', 'teal', 'indigo']
    : ['red', 'yellow', 'green', 'blue']
)
</script>

<template>
  <div class="dos-color-picker">
    <button
      v-for="color in colors"
      :key="color"
      class="dos-color-btn"
      :class="color"
      @click="emit('choose', color)"
    >
      {{ color.charAt(0).toUpperCase() + color.slice(1) }}
    </button>
  </div>
</template>
