<script setup lang="ts">
type AnimationEvent =
  | { kind: 'cardPlayed'; card: { color: string; value: string } }
  | { kind: 'giftPlayed'; recipientIndex: number; giftCard: { color: string; value: string } }
  | { kind: 'fairyGobble'; thiefIndex: number; victimIndex: number; stolenCard: { color: string; value: string }; stolenCardIndex: number }
  | { kind: 'flip'; isNowFlipped: boolean }
  | { kind: 'halfItUp'; removedCards: { color: string; value: string }[][] }
  | { kind: 'victory'; winnerIndex: number; winnerName: string }
  | { kind: 'announcement'; text: string; playerIndex: number }
  | { kind: 'cardsDrawn'; playerIndex: number; count: number }

interface Opponent {
  index: number
  name: string
  cardCount: number
  connected: boolean
}

const props = defineProps<{
  playerNames: string[]
  myIndex: number
  myHand: { color: string; value: string }[]
  opponents: Opponent[]
}>()

const shiftAnimation = inject<() => AnimationEvent | undefined>('shiftAnimation')
const flushDeferredState = inject<() => void>('flushDeferredState')
const doomedMyIndices = inject<Ref<number[]>>('doomedMyIndices')
const hiddenMyIndices = inject<Ref<number[]>>('hiddenMyIndices')
const doomedOpponentMap = inject<Ref<Record<number, number[]>>>('doomedOpponentMap')
const hiddenOpponentMap = inject<Ref<Record<number, number[]>>>('hiddenOpponentMap')

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
  if (currentAnim.value) return // animation already in progress
  const next = shiftAnimation()
  if (!next) {
    currentAnim.value = null
    return
  }
  currentAnim.value = next

  switch (next.kind) {
    case 'cardPlayed': scheduleNext(600); break
    case 'giftPlayed': playGiftAnimation(); break
    case 'fairyGobble': playFairyGobbleAnimation(next.thiefIndex, next.victimIndex, next.stolenCardIndex); break
    case 'flip': playFlipAnimation(next.isNowFlipped); break
    case 'halfItUp': playHalfItUpAnimation(next.removedCards); break
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

  later(() => { giftShaking.value = true }, 500)

  later(() => {
    giftShaking.value = false
    giftOpened.value = true
    giftCardRevealed.value = true

    const stars: typeof giftStars.value = []
    for (let i = 0; i < 12; i++) {
      stars.push({ id: i, x: 0, y: 0, angle: (360 / 12) * i })
    }
    giftStars.value = stars
  }, 2500)

  later(() => { giftSubtitleVisible.value = true }, 3300)

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

  later(() => { giftFadingOut.value = true }, 6000)
  scheduleNext(7000)
}

// ─── FAIRY GOBBLE ANIMATION ───
function playFairyGobbleAnimation(thiefIndex: number, victimIndex: number, stolenCardIndex: number) {
  fairyMessageVisible.value = false
  fairySubtitleVisible.value = false
  fairyEating.value = false
  fairyStolenCardVisible.value = false
  fairyExiting.value = false
  fairyTrails.value = []
  miniFairies.value = []
  bgFairies.value = []

  const edges = ['top', 'right', 'bottom', 'left']

  const stolenFromMe = victimIndex === props.myIndex

  // Highlight the target card in the victim's hand
  if (stolenFromMe) {
    if (doomedMyIndices) doomedMyIndices.value = [stolenCardIndex]
  } else {
    if (doomedOpponentMap) {
      doomedOpponentMap.value = { ...doomedOpponentMap.value, [victimIndex]: [stolenCardIndex] }
    }
  }

  // Capture target card position
  let targetX = 50
  let targetY = stolenFromMe ? 80 : 10
  later(() => {
    let selector: string
    if (stolenFromMe) {
      selector = '.dos-my-area .dos-card'
    } else {
      selector = `[data-player-index="${victimIndex}"] .dos-card`
    }
    const cardEls = document.querySelectorAll(selector)
    const targetEl = cardEls[stolenCardIndex] as HTMLElement | undefined
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      targetX = (rect.left + rect.width / 2) / window.innerWidth * 100
      targetY = (rect.top + rect.height / 2) / window.innerHeight * 100
    }
  }, 50)

  // Start fairy off-screen from random edge
  const edge = edges[Math.floor(Math.random() * edges.length)]
  const startPos: Record<string, string> = {}
  switch (edge) {
    case 'top': startPos.top = '-60px'; startPos.left = Math.random() * 80 + 10 + '%'; break
    case 'right': startPos.right = '-60px'; startPos.top = Math.random() * 80 + 10 + '%'; break
    case 'bottom': startPos.bottom = '-60px'; startPos.left = Math.random() * 80 + 10 + '%'; break
    case 'left': startPos.left = '-60px'; startPos.top = Math.random() * 80 + 10 + '%'; break
  }
  fairyStyle.value = { ...startPos, transition: 'none' }

  later(() => { fairyMessageVisible.value = true }, 500)
  later(() => { fairySubtitleVisible.value = true }, 800)

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

        later(() => {
          bgFairies.value = bgFairies.value.map(f =>
            f.id === bfId ? { ...f, style: { ...f.style, top: 30 + Math.random() * 40 + '%', left: 20 + Math.random() * 60 + '%', right: 'auto', bottom: 'auto' } } : f
          )
        }, 100)

        later(() => {
          bgFairies.value = bgFairies.value.map(f =>
            f.id === bfId ? { ...f, style: { ...f.style, opacity: '0', top: Math.random() > 0.5 ? '-50px' : '110%', left: Math.random() * 100 + '%' } } : f
          )
        }, 3000)
      }, Math.random() * 2000)
    }
  }, 1500)

  later(() => {
    fairyStyle.value = {
      top: targetY + '%', left: (targetX - 3) + '%',
      transform: 'scale(1)',
      transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }

    let trailCount = 0
    const trailInterval = setInterval(() => {
      if (trailCount++ > 12) { clearInterval(trailInterval); return }
      const progress = trailCount / 12
      const trail = {
        id: Date.now() + trailCount,
        left: (50 + (targetX - 50) * progress + (Math.random() - 0.5) * 10) + '%',
        top: (50 + (targetY - 50) * progress + (Math.random() - 0.5) * 10) + '%'
      }
      fairyTrails.value = [...fairyTrails.value, trail]
      later(() => {
        fairyTrails.value = fairyTrails.value.filter(t => t.id !== trail.id)
      }, 1000)
    }, 100)
    allTimeouts.push(trailInterval as unknown as ReturnType<typeof setTimeout>)
  }, 2000)

  later(() => {
    fairyStyle.value = {
      top: targetY + '%', left: targetX + '%',
      transform: 'scale(1.2)',
      transition: 'all 0.5s ease-in-out'
    }
    fairyEating.value = true

    let pulseCount = 0
    const pulseInterval = setInterval(() => {
      if (pulseCount++ > 5) { clearInterval(pulseInterval); return }
      const scale = pulseCount % 2 === 0 ? 1.3 : 1.1
      fairyStyle.value = {
        ...fairyStyle.value,
        transform: `scale(${scale})`
      }
    }, 150)
    allTimeouts.push(pulseInterval as unknown as ReturnType<typeof setTimeout>)
  }, 3400)

  later(() => {
    if (stolenFromMe) {
      if (hiddenMyIndices) hiddenMyIndices.value = [stolenCardIndex]
      if (doomedMyIndices) doomedMyIndices.value = []
    } else {
      if (hiddenOpponentMap) {
        hiddenOpponentMap.value = { ...hiddenOpponentMap.value, [victimIndex]: [stolenCardIndex] }
      }
      if (doomedOpponentMap) {
        const copy = { ...doomedOpponentMap.value }
        delete copy[victimIndex]
        doomedOpponentMap.value = copy
      }
    }
    later(() => {
      if (flushDeferredState) flushDeferredState()
      if (hiddenMyIndices) hiddenMyIndices.value = []
      if (hiddenOpponentMap) hiddenOpponentMap.value = {}
    }, 300)
  }, 4200)

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
      later(() => {
        flipLights.value = flipLights.value.filter(l => l.id !== Date.now() + i)
      }, 1000)
    }, i * 100)
  }
  scheduleNext(4000)
}

// ─── HALF IT UP ANIMATION ───
function playHalfItUpAnimation(removedCards: { color: string; value: string }[][]) {
  halfBannerVisible.value = true
  halfFlyingCards.value = []
  halfGlitterTrails.value = []

  const myRemoved = removedCards[props.myIndex]

  // Build per-opponent removed cards and compute doomed indices
  const opponentRemovedMap: Record<number, { color: string; value: string }[]> = {}
  for (const opp of props.opponents) {
    opponentRemovedMap[opp.index] = removedCards[opp.index] || []
  }

  // Find which indices in myHand match the removed cards
  const usedIndices = new Set<number>()
  const doomedIndices: number[] = []
  for (const removed of myRemoved) {
    for (let i = 0; i < props.myHand.length; i++) {
      if (!usedIndices.has(i) && props.myHand[i].color === removed.color && props.myHand[i].value === removed.value) {
        doomedIndices.push(i)
        usedIndices.add(i)
        break
      }
    }
  }

  // Pick random opponent card indices to highlight per opponent
  const doomedOppMap: Record<number, number[]> = {}
  for (const opp of props.opponents) {
    const oppRemoved = opponentRemovedMap[opp.index]
    const oppCardCount = document.querySelectorAll(`[data-player-index="${opp.index}"] .dos-card`).length
    const oppIndicesPool = [...Array(oppCardCount).keys()]
    for (let i = oppIndicesPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [oppIndicesPool[i], oppIndicesPool[j]] = [oppIndicesPool[j], oppIndicesPool[i]]
    }
    doomedOppMap[opp.index] = oppIndicesPool.slice(0, Math.min(oppRemoved.length, oppCardCount))
  }

  // T+800ms: Mark actual hand cards as doomed
  later(() => {
    if (doomedMyIndices) doomedMyIndices.value = doomedIndices
    if (doomedOpponentMap) doomedOpponentMap.value = doomedOppMap
  }, 800)

  // T+2200ms: Capture DOM positions, then stagger-launch flying clones
  later(() => {
    // Capture positions of doomed cards from my hand
    const myCardEls = document.querySelectorAll('.dos-my-area .dos-card')
    const myCardPositions: { left: number; top: number }[] = []
    for (const idx of doomedIndices) {
      const el = myCardEls[idx] as HTMLElement | undefined
      if (el) {
        const rect = el.getBoundingClientRect()
        myCardPositions.push({
          left: rect.left / window.innerWidth * 100,
          top: rect.top / window.innerHeight * 100
        })
      } else {
        myCardPositions.push({ left: 30 + Math.random() * 40, top: 80 })
      }
    }

    // Capture positions of doomed cards from each opponent
    const oppCardPositionsMap: Record<number, { left: number; top: number }[]> = {}
    for (const opp of props.opponents) {
      const oppCardEls = document.querySelectorAll(`[data-player-index="${opp.index}"] .dos-card`)
      const positions: { left: number; top: number }[] = []
      for (const idx of (doomedOppMap[opp.index] || [])) {
        const el = oppCardEls[idx] as HTMLElement | undefined
        if (el) {
          const rect = el.getBoundingClientRect()
          positions.push({
            left: rect.left / window.innerWidth * 100,
            top: rect.top / window.innerHeight * 100
          })
        } else {
          positions.push({ left: 30 + Math.random() * 40, top: 5 })
        }
      }
      oppCardPositionsMap[opp.index] = positions
    }

    // Stop the doomed glow
    if (doomedMyIndices) doomedMyIndices.value = []
    if (doomedOpponentMap) doomedOpponentMap.value = {}

    // Build flying cards list
    type FlyCard = { color: string; value: string; startLeft: number; startTop: number; myHandIdx: number | null; oppPlayerIndex: number | null; oppHandIdx: number | null }
    const allFlyCards: FlyCard[] = []

    // Opponent cards
    for (const opp of props.opponents) {
      const oppRemoved = opponentRemovedMap[opp.index]
      const oppPositions = oppCardPositionsMap[opp.index] || []
      const oppDoomed = doomedOppMap[opp.index] || []
      for (let i = 0; i < oppRemoved.length; i++) {
        allFlyCards.push({
          color: oppRemoved[i].color,
          value: oppRemoved[i].value,
          startLeft: oppPositions[i]?.left ?? 50,
          startTop: oppPositions[i]?.top ?? 5,
          myHandIdx: null,
          oppPlayerIndex: opp.index,
          oppHandIdx: oppDoomed[i] ?? null
        })
      }
    }

    // My cards
    for (let i = 0; i < myRemoved.length; i++) {
      allFlyCards.push({
        color: myRemoved[i].color,
        value: myRemoved[i].value,
        startLeft: myCardPositions[i]?.left ?? 50,
        startTop: myCardPositions[i]?.top ?? 80,
        myHandIdx: doomedIndices[i],
        oppPlayerIndex: null,
        oppHandIdx: null
      })
    }

    const totalCards = allFlyCards.length

    for (let i = 0; i < totalCards; i++) {
      const { color, value, startLeft, startTop, myHandIdx, oppPlayerIndex, oppHandIdx } = allFlyCards[i]

      later(() => {
        // Hide this specific card from the hand as its clone launches
        if (myHandIdx !== null && hiddenMyIndices) {
          hiddenMyIndices.value = [...hiddenMyIndices.value, myHandIdx]
        }
        if (oppPlayerIndex !== null && oppHandIdx !== null && hiddenOpponentMap) {
          const current = hiddenOpponentMap.value[oppPlayerIndex] || []
          hiddenOpponentMap.value = { ...hiddenOpponentMap.value, [oppPlayerIndex]: [...current, oppHandIdx] }
        }

        const cardId = Date.now() + i
        halfFlyingCards.value = [...halfFlyingCards.value, {
          id: cardId,
          style: {
            left: startLeft + '%',
            top: startTop + '%',
            width: '60px',
            height: '90px',
            opacity: '1',
            transform: 'scale(1) rotate(0deg)',
            boxShadow: '0 0 15px #ff1744, 0 0 30px #ff1744'
          },
          color,
          value,
          wingColor: 'gold'
        }]

        later(() => {
          let glitterCount = 0
          const glitterInterval = setInterval(() => {
            if (glitterCount++ > 12) { clearInterval(glitterInterval); return }
            for (let g = 0; g < 3; g++) {
              const dotColor = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)]
              const progress = glitterCount / 12
              const dot = {
                id: Date.now() + i * 1000 + glitterCount * 10 + g,
                left: (startLeft + (50 - startLeft) * progress + (Math.random() - 0.5) * 5) + '%',
                top: (startTop + (45 - startTop) * progress + (Math.random() - 0.5) * 4) + '%',
                size: Math.random() * 7 + 4,
                color: dotColor
              }
              halfGlitterTrails.value = [...halfGlitterTrails.value, dot]
              later(() => {
                halfGlitterTrails.value = halfGlitterTrails.value.filter(d => d.id !== dot.id)
              }, 800)
            }
          }, 50)
          allTimeouts.push(glitterInterval as unknown as ReturnType<typeof setTimeout>)

          halfFlyingCards.value = halfFlyingCards.value.map(c =>
            c.id === cardId ? {
              ...c,
              style: {
                ...c.style,
                left: '48%',
                top: '45%',
                opacity: '0.5',
                transform: `scale(0.4) rotate(${Math.random() * 360 - 180}deg)`,
                transition: 'all 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              }
            } : c
          )
        }, 100)

        later(() => {
          halfFlyingCards.value = halfFlyingCards.value.filter(c => c.id !== cardId)
        }, 2000)
      }, i * 180)
    }
  }, 2200)

  // Calculate total removed across all players
  let totalRemovedCount = myRemoved.length
  for (const opp of props.opponents) {
    totalRemovedCount += (opponentRemovedMap[opp.index] || []).length
  }
  const totalDuration = 2200 + totalRemovedCount * 180 + 2200

  later(() => {
    if (doomedMyIndices) doomedMyIndices.value = []
    if (hiddenMyIndices) hiddenMyIndices.value = []
    if (doomedOpponentMap) doomedOpponentMap.value = {}
    if (hiddenOpponentMap) hiddenOpponentMap.value = {}
    if (flushDeferredState) flushDeferredState()
    halfBannerVisible.value = false
  }, Math.max(totalDuration, 4000) - 100)

  scheduleNext(Math.max(totalDuration, 4000))
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
function playAnnouncement(text: string, playerIndex: number) {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = playerIndex === 0 ? 1.2 : 0.8
    utterance.volume = 1.0
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  }
}

onUnmounted(() => {
  if (doomedMyIndices) doomedMyIndices.value = []
  if (hiddenMyIndices) hiddenMyIndices.value = []
  if (doomedOpponentMap) doomedOpponentMap.value = {}
  if (hiddenOpponentMap) hiddenOpponentMap.value = {}
  if (flushDeferredState) flushDeferredState()
  clearAllTimers()
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
      {{ playerNames[currentAnim.thiefIndex] }} stole a card from {{ playerNames[currentAnim.victimIndex] }}!
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

    <!-- Flipping card visual -->
    <div class="dos-flipping-card">
      <div class="dos-card" :class="currentAnim.isNowFlipped ? 'red' : 'lavender'">
        <span>{{ currentAnim.isNowFlipped ? '+2' : '+5' }}</span>
      </div>
    </div>

    <!-- Flashing lights with glow -->
    <div
      v-for="light in flipLights"
      :key="light.id"
      class="dos-flip-light"
      :style="{ left: light.left, top: light.top, background: light.color, boxShadow: light.shadow }"
    />
  </div>

  <!-- ═══ HALF IT UP ANIMATION ═══ -->
  <!-- Banner -->
  <div v-if="currentAnim?.kind === 'halfItUp' && halfBannerVisible" class="dos-half-banner-fixed">
    HALF IT UP!
  </div>
  <p v-if="currentAnim?.kind === 'halfItUp' && halfBannerVisible" class="dos-half-subtitle-fixed">
    Removing cards from all players!
  </p>

  <!-- Overlay only during flight phase -->
  <div v-if="currentAnim?.kind === 'halfItUp' && halfFlyingCards.length > 0" class="dos-half-overlay">
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
