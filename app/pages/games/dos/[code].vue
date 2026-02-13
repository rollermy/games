<script setup lang="ts">
import '~/assets/css/dos-game.css'

definePageMeta({
  layout: 'game',
  gameTitle: 'DOS'
})

const route = useRoute()
const { user, isLoggedIn } = useAuth()
const code = computed(() => (route.params.code as string).toUpperCase())

const {
  gameState,
  connected,
  animationQueue,
  error,
  roomInfo,
  gameStarted,
  opponentDisconnected,
  gameOver,
  guestJoined,
  connect,
  playCard,
  draw,
  pass,
  chooseColor,
  shiftAnimation
} = useGameSocket()

// Determine role from URL query or auth state
const role = ref<'host' | 'guest' | null>(null)
const guestName = ref('')
const joined = ref(false)
const roomData = ref<{ hostName: string; hostUserId: string; status: string } | null>(null)
const loadingRoom = ref(true)
const fetchError = ref<string | null>(null)
const animRef = ref<InstanceType<typeof import('~/components/games/dos/DosAnimations.vue').default> | null>(null)

// Provide shiftAnimation to animation component
provide('shiftAnimation', shiftAnimation)

// Fetch room info first
onMounted(async () => {
  try {
    const data = await $fetch(`/api/games/rooms/${code.value}`)
    roomData.value = { hostName: data.hostName, hostUserId: data.hostUserId, status: data.status }

    // Determine role: if logged in AND you are the room host, connect as host.
    if (isLoggedIn.value && user.value?.id === data.hostUserId) {
      role.value = 'host'
      connect(code.value, 'host')
      joined.value = true
    }
  } catch (e: any) {
    fetchError.value = e?.data?.statusMessage || 'Room not found'
  } finally {
    loadingRoom.value = false
  }
})

function joinAsGuest() {
  if (!guestName.value.trim()) return
  role.value = 'guest'
  connect(code.value, 'guest', guestName.value.trim())
  joined.value = true
}

const phase = computed(() => {
  if (gameState.value?.winner !== null && gameState.value?.winner !== undefined) return 'finished'
  if (gameStarted.value && gameState.value) return 'playing'
  return 'lobby'
})

const shareUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/games/dos/${code.value}`
})

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

// Trigger animation processing when queue changes
watch(animationQueue, (queue) => {
  if (queue.length > 0 && animRef.value) {
    animRef.value.processNext()
  }
})
</script>

<template>
  <div class="dos-game min-h-screen text-white" style="background-color: #48aaff;">
    <!-- Disconnect banner -->
    <div v-if="opponentDisconnected" class="dos-disconnect-banner">
      Opponent disconnected — waiting for reconnection...
    </div>

    <!-- Error state -->
    <div v-if="(fetchError || error) && !gameState" class="flex items-center justify-center min-h-screen">
      <UCard>
        <template #header>
          <h3 class="text-lg font-bold text-red-500">Error</h3>
        </template>
        <p>{{ fetchError || error }}</p>
        <template #footer>
          <UButton to="/dashboard">Back to Dashboard</UButton>
        </template>
      </UCard>
    </div>

    <!-- Loading -->
    <div v-else-if="loadingRoom" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <USkeleton class="w-48 h-8 mx-auto mb-4" />
        <USkeleton class="w-32 h-4 mx-auto" />
      </div>
    </div>

    <!-- LOBBY PHASE -->
    <div v-else-if="phase === 'lobby'" class="dos-lobby">
      <!-- Host lobby -->
      <template v-if="role === 'host'">
        <h2 class="text-2xl font-bold mb-4">DOS Game Room</h2>
        <div class="dos-room-code">{{ code }}</div>

        <p class="mb-4 opacity-80">Share this link with your opponent:</p>
        <div class="dos-share-link" @click="copyLink">
          {{ shareUrl }}
          <span v-if="copied" class="ml-2 text-green-400">Copied!</span>
        </div>

        <div class="mt-8">
          <template v-if="guestJoined">
            <p class="text-xl font-bold text-green-400">{{ guestJoined }} joined!</p>
            <p class="opacity-70">Starting game...</p>
          </template>
          <template v-else>
            <p class="opacity-70">Waiting for opponent to join...</p>
            <div class="mt-4">
              <USkeleton class="w-8 h-8 mx-auto rounded-full" />
            </div>
          </template>
        </div>
      </template>

      <!-- Guest join -->
      <template v-else-if="!joined">
        <h2 class="text-2xl font-bold mb-4">Join DOS Game</h2>
        <p class="mb-2">Room: <span class="font-bold">{{ code }}</span></p>
        <p v-if="roomData" class="mb-6 opacity-80">
          Hosted by <span class="font-bold">{{ roomData.hostName }}</span>
        </p>

        <div class="max-w-xs mx-auto">
          <UInput
            v-model="guestName"
            placeholder="Enter your display name"
            size="lg"
            class="mb-4"
            @keyup.enter="joinAsGuest"
          />
          <UButton
            block
            size="lg"
            :disabled="!guestName.trim()"
            @click="joinAsGuest"
          >
            Join Game
          </UButton>
        </div>
      </template>

      <!-- Guest waiting -->
      <template v-else>
        <h2 class="text-2xl font-bold mb-4">DOS Game Room</h2>
        <div class="dos-room-code">{{ code }}</div>
        <p class="opacity-70">Waiting for host to start...</p>
      </template>
    </div>

    <!-- PLAYING PHASE -->
    <template v-else-if="phase === 'playing' && gameState">
      <GamesDosGame
        :state="gameState"
        @play-card="playCard"
        @draw="draw"
        @pass="pass"
        @choose-color="chooseColor"
      />
    </template>

    <!-- FINISHED PHASE -->
    <div v-else-if="phase === 'finished'" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <h2 class="text-4xl font-bold mb-4" style="color: gold;">Game Over!</h2>
        <p class="text-2xl mb-8">
          {{ gameOver?.winnerName || (gameState?.winner !== null ? gameState?.playerNames[gameState.winner] : '') }} wins!
        </p>
        <UButton to="/dashboard" size="lg">Back to Dashboard</UButton>
      </div>
    </div>

    <!-- Animation overlay -->
    <GamesDosAnimations
      v-if="gameState"
      ref="animRef"
      :player-names="gameState.playerNames"
    />
  </div>
</template>
