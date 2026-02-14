<script setup lang="ts">
definePageMeta({
  layout: 'game',
  gameTitle: 'DOS'
})

const router = useRouter()
const gameCode = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function joinGame() {
  const trimmed = gameCode.value.trim().toUpperCase()
  if (!trimmed) return

  loading.value = true
  error.value = null

  try {
    await $fetch(`/api/games/rooms/${trimmed}`)
    await router.push(`/games/dos/${trimmed}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Room not found'
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen text-white flex items-center justify-center" style="background-color: #48aaff;">
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-6">Join a DOS Game</h2>

      <div class="max-w-xs mx-auto">
        <UInput
          v-model="gameCode"
          placeholder="Enter game code"
          size="lg"
          class="mb-4"
          @keyup.enter="joinGame"
        />
        <p v-if="error" class="text-red-300 mb-4 text-sm">{{ error }}</p>
        <UButton
          block
          size="lg"
          :loading="loading"
          :disabled="!gameCode.trim()"
          @click="joinGame"
        >
          Join Game
        </UButton>
      </div>
    </div>
  </div>
</template>
