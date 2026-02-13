<script setup lang="ts">
type AnimationEvent =
  | { kind: 'cardPlayed'; card: { color: string; value: string } }
  | { kind: 'giftPlayed'; recipientIndex: 0 | 1; giftCard: { color: string; value: string } }
  | { kind: 'fairyGobble'; thiefIndex: 0 | 1; stolenCard: { color: string; value: string } }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCounts: [number, number] }
  | { kind: 'victory'; winnerIndex: 0 | 1; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: 0 | 1 }
  | { kind: 'cardsDrawn'; playerIndex: 0 | 1; count: number }

const props = defineProps<{
  playerNames: [string, string]
}>()

const shiftAnimation = inject<() => AnimationEvent | undefined>('shiftAnimation')

const currentAnim = ref<AnimationEvent | null>(null)

// Gift animation state
const giftShaking = ref(false)
const giftOpened = ref(false)
const giftCardRevealed = ref(false)
const giftSubtitleVisible = ref(false)
const giftStars = ref<{ id: number; x: number; y: number; angle: number }[]>([])
const giftGlitter = ref<{ id: number; left: string; size: number; color: string; duration: number; delay: number; opacity: number }[]>([])
const giftFadingOut = ref(false)

// Fairy state
const fairyStyle = ref<Record<string, string>>({})
const fairyTrails = ref<{ id: number; left: string; top: string }[]>([])
const fairyEating = ref(false)
const fairyStolenCardVisible = ref(true)
const fairyMessageVisible = ref(false)
const fairySubtitleVisible = ref(false)
const fairyExiting = ref(false)
const miniFairies = ref<{ id: number; style: Record<string, string> }[]>([])
const bgFairies = ref<{ id: number; style: Record<string, string> }[]>([])

// Flip state
const flipLights = ref<{ id: number; left: string; top: string; color: string; shadow: string }[]>([])
const flipSubtitleText = ref('')

// Half it up state
const halfBannerVisible = ref(false)
const halfFlyingCards = ref<{ id: number; style: Record<string, string>; color: string; value: string; wingColor: string }[]>([])
const halfGlitterTrails = ref<{ id: number; left: string; top: string; size: number; color: string }[]>([])

// Victory state
const victoryGlitter = ref<{ id: number; left: string; size: number; color: string; duration: number; delay: number; opacity: number }[]>([])
let victoryInterval: ReturnType<typeof setInterval> | null = null

const PRESENT_COLORS = [
  { box: '#e53935', lid: '#b71c1c', ribbon: '#ffcdd2', ribbonColor: '#d32f2f' },
  { box: '#1e88e5', lid: '#0d47a1', ribbon: '#bbdefb', ribbonColor: '#1565c0' },
  { box: '#43a047', lid: '#1b5e20', ribbon: '#c8e6c9', ribbonColor: '#2e7d32' },
  { box: '#fbc02d', lid: '#f57f17', ribbon: '#fff9c4', ribbonColor: '#f9a825' },
  { box: '#8e24aa', lid: '#4a148c', ribbon: '#e1bee7', ribbonColor: '#6a1b9a' },
  { box: '#ff6d00', lid: '#e65100', ribbon: '#ffe0b2', ribbonColor: '#ef6c00' },
  { box: '#00acc1', lid: '#006064', ribbon: '#b2ebf2', ribbonColor: '#00838f' }
]
const presentColor = ref(PRESENT_COLORS[0])

const GLITTER_COLORS = ['gold', 'silver', '#e53935', '#fbc02d', '#43a047', '#1e88e5']
const TRAIL_COLORS = ['gold', '#fff', '#ffd600', '#ff4081', '#e040fb', '#40c4ff']

let animTimer: ReturnType<typeof setTimeout> | null = null
let allTimeouts: ReturnType<typeof setTimeout>[] = []

function later(fn: () => void, ms: number) {
  const t = setTimeout(fn, ms)
  allTimeouts.push(t)
  return t
}

function clearAllTimers() {
  if (animTimer) clearTimeout(animTimer)
  allTimeouts.forEach(t => clearTimeout(t))
  allTimeouts = []
}

function processNext() {
  if (!shiftAnimation) return
  const next = shiftAnimation()
  if (!next) {
    currentAnim.value = null
    return
  }
  currentAnim.value = next

  switch (next.kind) {
    case 'cardPlayed': scheduleNext(600); break
    case 'giftPlayed': playGiftAnimation(); break
    case 'fairyGobble': playFairyGobbleAnimation(); break
    case 'flip': playFlipAnimation(next.isNowFlipped); break
    case 'halfItUp': playHalfItUpAnimation(next.removedCounts); break
    case 'victory': playVictoryAnimation(); break
    case 'announcement': playAnnouncement(next.text, next.playerIndex); scheduleNext(2000); break
    case 'cardsDrawn': scheduleNext(1000); break
  }
}

function scheduleNext(ms: number) {
  if (animTimer) clearTimeout(animTimer)
  animTimer = later(() => {
    clearAllTimers()
    currentAnim.value = null
    nextTick(() => processNext())
  }, ms)
}

// ─── GIFT ANIMATION ───
function playGiftAnimation() {
  presentColor.value = PRESENT_COLORS[Math.floor(Math.random() * PRESENT_COLORS.length)]
  giftShaking.value = false
  giftOpened.value = false
  giftCardRevealed.value = false
  giftSubtitleVisible.value = false
  giftStars.value = []
  giftGlitter.value = []
  giftFadingOut.value = false

  // T+500ms: Start shaking
  later(() => { giftShaking.value = true }, 500)

  // T+2500ms: Open lid, reveal card, star burst
  later(() => {
    giftShaking.value = false
    giftOpened.value = true
    giftCardRevealed.value = true

    // 12 star burst particles
    const stars: typeof giftStars.value = []
    for (let i = 0; i < 12; i++) {
      stars.push({ id: i, x: 0, y: 0, angle: (360 / 12) * i })
    }
    giftStars.value = stars
  }, 2500)

  // T+3300ms: Show subtitle
  later(() => { giftSubtitleVisible.value = true }, 3300)

  // T+2700ms: Spawn glitter
  later(() => {
    for (let i = 0; i < 80; i++) {
      later(() => {
        const size = Math.random() * 10 + 5
        const color = GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)]
        giftGlitter.value = [...giftGlitter.value, {
          id: Date.now() + i,
          left: Math.random() * 100 + '%',
          size,
          color,
          duration: Math.random() * 3 + 2,
          delay: 0,
          opacity: Math.random() * 0.7 + 0.3
        }]
      }, Math.random() * 1500)
    }
  }, 2700)

  // T+6000ms: Fade out
  later(() => { giftFadingOut.value = true }, 6000)
  scheduleNext(7000)
}

// ─── FAIRY GOBBLE ANIMATION ───
function playFairyGobbleAnimation() {
  fairyMessageVisible.value = false
  fairySubtitleVisible.value = false
  fairyEating.value = false
  fairyStolenCardVisible.value = true
  fairyExiting.value = false
  fairyTrails.value = []
  miniFairies.value = []
  bgFairies.value = []

  // Start fairy off-screen from random edge
  const edges = ['top', 'right', 'bottom', 'left']
  const edge = edges[Math.floor(Math.random() * edges.length)]
  const startPos: Record<string, string> = {}
  switch (edge) {
    case 'top': startPos.top = '-60px'; startPos.left = Math.random() * 80 + 10 + '%'; break
    case 'right': startPos.right = '-60px'; startPos.top = Math.random() * 80 + 10 + '%'; break
    case 'bottom': startPos.bottom = '-60px'; startPos.left = Math.random() * 80 + 10 + '%'; break
    case 'left': startPos.left = '-60px'; startPos.top = Math.random() * 80 + 10 + '%'; break
  }
  fairyStyle.value = { ...startPos, transition: 'none' }

  // T+500ms: Show message
  later(() => { fairyMessageVisible.value = true }, 500)
  // T+800ms: Show subtitle
  later(() => { fairySubtitleVisible.value = true }, 800)

  // T+1500ms: Spawn background fairies
  later(() => {
    for (let i = 0; i < 15; i++) {
      later(() => {
        const bfId = Date.now() + i
        const startEdge = edges[Math.floor(Math.random() * edges.length)]
        const style: Record<string, string> = {
          width: '15px', height: '15px',
          transition: 'all 2s ease-in-out'
        }
        switch (startEdge) {
          case 'top': style.top = '-20px'; style.left = Math.random() * 100 + '%'; break
          case 'right': style.right = '-20px'; style.top = Math.random() * 100 + '%'; break
          case 'bottom': style.bottom = '-20px'; style.left = Math.random() * 100 + '%'; break
          case 'left': style.left = '-20px'; style.top = Math.random() * 100 + '%'; break
        }
        bgFairies.value = [...bgFairies.value, { id: bfId, style }]

        // Move to center area
        later(() => {
          bgFairies.value = bgFairies.value.map(f =>
            f.id === bfId ? { ...f, style: { ...f.style, top: 30 + Math.random() * 40 + '%', left: 20 + Math.random() * 60 + '%', right: 'auto', bottom: 'auto' } } : f
          )
        }, 100)

        // Exit
        later(() => {
          bgFairies.value = bgFairies.value.map(f =>
            f.id === bfId ? { ...f, style: { ...f.style, opacity: '0', top: Math.random() > 0.5 ? '-50px' : '110%', left: Math.random() * 100 + '%' } } : f
          )
        }, 3000)
      }, Math.random() * 2000)
    }
  }, 1500)

  // T+2000ms: Main fairy flies to center
  later(() => {
    fairyStyle.value = {
      top: '45%', left: '50%',
      transform: 'translate(-50%, -50%)',
      transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }

    // Trail particles during flight
    let trailCount = 0
    const trailInterval = setInterval(() => {
      if (trailCount++ > 12) { clearInterval(trailInterval); return }
      const trail = {
        id: Date.now() + trailCount,
        left: Math.random() * 30 + 35 + '%',
        top: Math.random() * 30 + 30 + '%'
      }
      fairyTrails.value = [...fairyTrails.value, trail]
      later(() => {
        fairyTrails.value = fairyTrails.value.filter(t => t.id !== trail.id)
      }, 1000)
    }, 100)
    allTimeouts.push(trailInterval as unknown as ReturnType<typeof setTimeout>)
  }, 2000)

  // T+3400ms: Fairy reaches card, eating animation
  later(() => {
    fairyStyle.value = {
      top: '42%', left: '50%',
      transform: 'translate(-50%, -50%) scale(1.3)',
      transition: 'all 0.5s ease-in-out'
    }
    fairyEating.value = true

    // Pulsing during eating
    let pulseCount = 0
    const pulseInterval = setInterval(() => {
      if (pulseCount++ > 5) { clearInterval(pulseInterval); return }
      const scale = pulseCount % 2 === 0 ? 1.3 : 1.1
      fairyStyle.value = {
        ...fairyStyle.value,
        transform: `translate(-50%, -50%) scale(${scale})`
      }
    }, 150)
    allTimeouts.push(pulseInterval as unknown as ReturnType<typeof setTimeout>)
  }, 3400)

  // T+4200ms: Card disappears
  later(() => {
    fairyStolenCardVisible.value = false
  }, 4200)

  // T+5000ms: Fairy exits with mini-fairies
  later(() => {
    fairyEating.value = false
    fairyExiting.value = true

    const exitEdge = edges[Math.floor(Math.random() * edges.length)]
    const exitStyle: Record<string, string> = {
      transition: 'all 1.5s ease-in-out', opacity: '0'
    }
    switch (exitEdge) {
      case 'top': exitStyle.top = '-100px'; exitStyle.left = Math.random() * 80 + 10 + '%'; break
      case 'right': exitStyle.left = '110%'; exitStyle.top = Math.random() * 80 + 10 + '%'; break
      case 'bottom': exitStyle.top = '110%'; exitStyle.left = Math.random() * 80 + 10 + '%'; break
      case 'left': exitStyle.left = '-100px'; exitStyle.top = Math.random() * 80 + 10 + '%'; break
    }
    fairyStyle.value = exitStyle

    // Mini trailing fairies
    for (let i = 0; i < 5; i++) {
      later(() => {
        miniFairies.value = [...miniFairies.value, {
          id: Date.now() + i,
          style: {
            ...exitStyle,
            width: '15px', height: '15px',
            transitionDelay: (i * 0.15) + 's'
          }
        }]
      }, i * 100)
    }
  }, 5000)

  scheduleNext(7000)
}

// ─── FLIP ANIMATION ───
function playFlipAnimation(isNowFlipped: boolean) {
  flipLights.value = []
  flipSubtitleText.value = isNowFlipped ? 'Transforming all cards!' : 'Returning cards to normal!'

  const colors = ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#9c64a6', '#48c9b0', '#00897b', '#1a237e']
  for (let i = 0; i < 30; i++) {
    later(() => {
      const color = colors[Math.floor(Math.random() * colors.length)]
      flipLights.value = [...flipLights.value, {
        id: Date.now() + i,
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        color,
        shadow: `0 0 15px ${color}, 0 0 30px ${color}`
      }]
      // Remove after 1s
      later(() => {
        flipLights.value = flipLights.value.filter(l => l.id !== Date.now() + i)
      }, 1000)
    }, i * 100)
  }
  scheduleNext(4000)
}

// ─── HALF IT UP ANIMATION ───
function playHalfItUpAnimation(removedCounts: [number, number]) {
  halfBannerVisible.value = true
  halfFlyingCards.value = []
  halfGlitterTrails.value = []

  const totalCards = removedCounts[0] + removedCounts[1]
  const cardColors = ['red', 'yellow', 'green', 'blue']
  const cardValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', '+2']

  // T+800ms: Create flying cards
  later(() => {
    for (let i = 0; i < totalCards; i++) {
      const isP0 = i < removedCounts[0]
      const startLeft = 10 + Math.random() * 80
      const startTop = isP0 ? 70 + Math.random() * 20 : 5 + Math.random() * 20
      const color = cardColors[Math.floor(Math.random() * cardColors.length)]
      const value = cardValues[Math.floor(Math.random() * cardValues.length)]

      later(() => {
        const cardId = Date.now() + i
        halfFlyingCards.value = [...halfFlyingCards.value, {
          id: cardId,
          style: {
            left: startLeft + '%',
            top: startTop + '%',
            width: '60px',
            height: '90px',
            opacity: '1',
            transform: 'scale(1) rotate(0deg)'
          },
          color,
          value,
          wingColor: 'gold'
        }]

        // Add red glow initially
        later(() => {
          halfFlyingCards.value = halfFlyingCards.value.map(c =>
            c.id === cardId ? {
              ...c,
              style: { ...c.style, boxShadow: '0 0 15px #ff1744, 0 0 30px #ff1744' }
            } : c
          )
        }, 50)

        // Start flight to center after glow
        later(() => {
          // Spawn glitter trail
          let glitterCount = 0
          const glitterInterval = setInterval(() => {
            if (glitterCount++ > 8) { clearInterval(glitterInterval); return }
            const dotColor = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)]
            const dot = {
              id: Date.now() + i * 100 + glitterCount,
              left: (startLeft + (50 - startLeft) * (glitterCount / 8)) + '%',
              top: (startTop + (50 - startTop) * (glitterCount / 8)) + '%',
              size: Math.random() * 7 + 4,
              color: dotColor
            }
            halfGlitterTrails.value = [...halfGlitterTrails.value, dot]
            later(() => {
              halfGlitterTrails.value = halfGlitterTrails.value.filter(d => d.id !== dot.id)
            }, 800)
          }, 50)
          allTimeouts.push(glitterInterval as unknown as ReturnType<typeof setTimeout>)

          // Fly to center
          halfFlyingCards.value = halfFlyingCards.value.map(c =>
            c.id === cardId ? {
              ...c,
              style: {
                ...c.style,
                left: '48%',
                top: '45%',
                opacity: '0.3',
                transform: `scale(0.4) rotate(${Math.random() * 360}deg)`,
                transition: 'all 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              }
            } : c
          )
        }, 400)

        // Remove card after flight
        later(() => {
          halfFlyingCards.value = halfFlyingCards.value.filter(c => c.id !== cardId)
        }, 2400)
      }, i * 180)
    }
  }, 800)

  const totalDuration = 800 + totalCards * 180 + 2800
  scheduleNext(Math.max(totalDuration, 3500))
}

// ─── VICTORY ANIMATION ───
function playVictoryAnimation() {
  victoryGlitter.value = []
  spawnVictoryGlitter()
  victoryInterval = setInterval(spawnVictoryGlitter, 3000)
}

function spawnVictoryGlitter() {
  for (let i = 0; i < 200; i++) {
    later(() => {
      const size = Math.random() * 10 + 5
      const color = GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)]
      const duration = Math.random() * 5 + 3
      const delay = Math.random() * 10
      const particle = {
        id: Date.now() + Math.random() * 100000,
        left: Math.random() * 100 + '%',
        size,
        color,
        duration,
        delay,
        opacity: Math.random() * 0.7 + 0.3
      }
      victoryGlitter.value = [...victoryGlitter.value, particle]

      later(() => {
        victoryGlitter.value = victoryGlitter.value.filter(g => g.id !== particle.id)
      }, (duration + delay) * 1000)
    }, Math.random() * 3000)
  }
}

function dismissVictory() {
  if (victoryInterval) { clearInterval(victoryInterval); victoryInterval = null }
  victoryGlitter.value = []
  clearAllTimers()
  currentAnim.value = null
  nextTick(() => processNext())
}

// ─── ANNOUNCEMENT ───
function playAnnouncement(text: string, playerIndex: 0 | 1) {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = playerIndex === 0 ? 1.2 : 0.8
    utterance.volume = 1.0
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  }
}

// Watch for new animations
watch(() => shiftAnimation, () => {
  if (!currentAnim.value) processNext()
}, { immediate: true })

const checkInterval = setInterval(() => {
  if (!currentAnim.value && shiftAnimation) {
    const peek = shiftAnimation()
    if (peek) {
      currentAnim.value = peek
      processNext()
    }
  }
}, 500)

onUnmounted(() => {
  clearAllTimers()
  clearInterval(checkInterval)
  if (victoryInterval) clearInterval(victoryInterval)
})

defineExpose({ processNext })
</script>

<template>
  <!-- ═══ GIFT ANIMATION ═══ -->
  <div v-if="currentAnim?.kind === 'giftPlayed'" class="dos-gift-overlay" :class="{ 'fade-out': giftFadingOut }">
    <div class="dos-gift-message">GIFT CARD PLAYED!</div>

    <div class="dos-present-wrapper" :class="{ shaking: giftShaking }">
      <!-- Present box with ribbons -->
      <div class="dos-present-box" :style="{ background: presentColor.box }">
        <div class="dos-present-ribbon-v" :style="{ background: presentColor.ribbon }" />
        <div class="dos-present-ribbon-h" :style="{ background: presentColor.ribbon }" />
      </div>

      <!-- Lid with ribbon -->
      <div class="dos-present-lid" :class="{ open: giftOpened }" :style="{ background: presentColor.lid }">
        <div class="dos-present-lid-ribbon" :style="{ background: presentColor.ribbon }" />
      </div>

      <!-- Bow -->
      <div class="dos-present-bow" :class="{ open: giftOpened }">
        <div class="dos-bow-loop left" :style="{ background: presentColor.ribbonColor }" />
        <div class="dos-bow-loop right" :style="{ background: presentColor.ribbonColor }" />
      </div>

      <!-- Star burst -->
      <div
        v-for="star in giftStars"
        :key="star.id"
        class="dos-present-star"
        :style="{
          left: '50%', top: '30%',
          transform: `translate(-50%, -50%) rotate(${star.angle}deg) translateY(-80px)`
        }"
      />

      <!-- Card reveal -->
      <div class="dos-present-card-reveal" :class="{ revealed: giftCardRevealed }">
        <GamesDosCard :card="currentAnim.giftCard" />
      </div>
    </div>

    <!-- Subtitle -->
    <div v-if="giftSubtitleVisible" class="dos-gift-subtitle">
      {{ playerNames[currentAnim.recipientIndex] }} received a {{ currentAnim.giftCard.value }}!
    </div>

    <!-- Falling glitter -->
    <div
      v-for="g in giftGlitter"
      :key="g.id"
      class="dos-anim-glitter"
      :style="{
        left: g.left,
        width: g.size + 'px', height: g.size + 'px',
        background: g.color,
        opacity: g.opacity,
        animationDuration: g.duration + 's',
        animationDelay: g.delay + 's'
      }"
    />
  </div>

  <!-- ═══ FAIRY GOBBLE ANIMATION ═══ -->
  <div v-if="currentAnim?.kind === 'fairyGobble'" class="dos-fairy-overlay">
    <!-- Message -->
    <div class="dos-fairy-message" :style="{ opacity: fairyMessageVisible ? 1 : 0, transition: 'opacity 0.5s' }">
      FAIRY GOBBLE!
    </div>
    <div class="dos-fairy-subtitle" :style="{ opacity: fairySubtitleVisible ? 1 : 0, transition: 'opacity 0.5s' }">
      {{ playerNames[currentAnim.thiefIndex] }} stole a card!
    </div>

    <!-- Stolen card (disappears when eaten) -->
    <div
      v-if="fairyStolenCardVisible"
      class="dos-fairy-target-card"
      :style="{ transition: 'all 0.3s', transform: fairyStolenCardVisible ? 'scale(1)' : 'scale(0)', opacity: fairyStolenCardVisible ? '1' : '0' }"
    >
      <GamesDosCard :card="currentAnim.stolenCard" />
    </div>

    <!-- Main fairy -->
    <div class="dos-main-fairy" :style="fairyStyle">
      <div class="dos-fairy-mouth" :class="{ eating: fairyEating }" />
    </div>

    <!-- Fairy trails -->
    <div
      v-for="trail in fairyTrails"
      :key="trail.id"
      class="dos-fairy-trail"
      :style="{ left: trail.left, top: trail.top }"
    />

    <!-- Mini fairies (exit trail) -->
    <div
      v-for="mf in miniFairies"
      :key="mf.id"
      class="dos-mini-fairy"
      :style="mf.style"
    />

    <!-- Background fairies -->
    <div
      v-for="bf in bgFairies"
      :key="bf.id"
      class="dos-bg-fairy"
      :style="bf.style"
    />
  </div>

  <!-- ═══ FLIP ANIMATION ═══ -->
  <div v-if="currentAnim?.kind === 'flip'" class="dos-flip-overlay">
    <div class="dos-flip-message">FLIP CARD PLAYED!</div>
    <p class="dos-flip-subtitle">{{ flipSubtitleText }}</p>

    <!-- Flashing lights with glow -->
    <div
      v-for="light in flipLights"
      :key="light.id"
      class="dos-flip-light"
      :style="{ left: light.left, top: light.top, background: light.color, boxShadow: light.shadow }"
    />
  </div>

  <!-- ═══ HALF IT UP ANIMATION ═══ -->
  <div v-if="currentAnim?.kind === 'halfItUp'" class="dos-half-overlay">
    <div class="dos-half-banner">HALF IT UP!</div>
    <p style="color: white; font-size: 1.3em; margin-top: 15px; position: relative; z-index: 1201;">
      Removing {{ currentAnim.removedCounts[0] }} + {{ currentAnim.removedCounts[1] }} cards!
    </p>

    <!-- Flying cards with wings -->
    <div
      v-for="card in halfFlyingCards"
      :key="card.id"
      class="dos-half-flying-card"
      :class="'dos-card ' + card.color"
      :style="card.style"
    >
      <span class="card-text" style="font-size: 0.8em;">{{ card.value }}</span>
      <div class="dos-half-wing left" :style="{ background: `linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,215,0,0.7))` }" />
      <div class="dos-half-wing right" :style="{ background: `linear-gradient(225deg, rgba(255,255,255,0.95), rgba(255,215,0,0.7))` }" />
    </div>

    <!-- Glitter trails -->
    <div
      v-for="dot in halfGlitterTrails"
      :key="dot.id"
      class="dos-half-glitter-dot"
      :style="{ left: dot.left, top: dot.top, width: dot.size + 'px', height: dot.size + 'px', background: dot.color }"
    />
  </div>

  <!-- ═══ VICTORY ANIMATION ═══ -->
  <div v-if="currentAnim?.kind === 'victory'" class="dos-victory-overlay">
    <div class="dos-victory-message">DOS VICTORY!</div>
    <div class="dos-victory-player">{{ currentAnim.winnerName }} Wins!</div>
    <button class="dos-play-again-btn" @click="dismissVictory">Continue</button>

    <!-- Falling glitter -->
    <div
      v-for="g in victoryGlitter"
      :key="g.id"
      class="dos-anim-glitter"
      :style="{
        left: g.left,
        width: g.size + 'px', height: g.size + 'px',
        background: g.color,
        opacity: g.opacity,
        animationDuration: g.duration + 's',
        animationDelay: g.delay + 's'
      }"
    />
  </div>

  <!-- ═══ ANNOUNCEMENT ═══ -->
  <div v-if="currentAnim?.kind === 'announcement'" class="dos-announcement">
    {{ currentAnim.text }}
  </div>

  <!-- ═══ CARDS DRAWN ═══ -->
  <div
    v-if="currentAnim?.kind === 'cardsDrawn'"
    class="dos-announcement"
    style="font-size: 2em; color: white;"
  >
    {{ playerNames[currentAnim.playerIndex] }} drew {{ currentAnim.count }} card{{ currentAnim.count > 1 ? 's' : '' }}
  </div>
</template>
