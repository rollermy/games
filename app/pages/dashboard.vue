<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const router = useRouter()
const creatingRoom = ref(false)

async function startDosGame() {
  creatingRoom.value = true
  try {
    const data = await $fetch('/api/games/rooms', { method: 'POST' })
    await router.push(`/games/dos/${data.code}`)
  } catch (e: any) {
    console.error('Failed to create room:', e)
    creatingRoom.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
    <p class="text-(--ui-text-muted) mb-8">Select a game to play.</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl"
              style="background: linear-gradient(135deg, #e53935 25%, #fbc02d 50%, #43a047 75%, #1e88e5 100%); color: #222;"
            >
              D
            </div>
            <div>
              <h3 class="text-lg font-bold">DOS</h3>
              <p class="text-sm text-(--ui-text-muted)">2-Player Card Game</p>
            </div>
          </div>
        </template>
        <p class="text-(--ui-text-muted) text-sm">
          An Uno variant with special cards like Gift, Fairy Gobble, Flip, and Half it up!
          Play against a friend in real-time.
        </p>
        <template #footer>
          <UButton
            block
            :loading="creatingRoom"
            @click="startDosGame"
          >
            Start New Game
          </UButton>
        </template>
      </UCard>
    </div>
  </div>
</template>
