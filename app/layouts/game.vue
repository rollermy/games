<script setup lang="ts">
const { user } = useAuth()
const route = useRoute()

const gameName = computed(() => {
  const meta = route.meta as Record<string, unknown>
  return (meta.gameTitle as string) || 'Game'
})
</script>

<template>
  <div class="min-h-screen">
    <header class="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <NuxtLink to="/dashboard" class="text-white/70 hover:text-white transition-colors text-sm">
            &larr; Back
          </NuxtLink>
          <span class="text-white font-bold text-lg">{{ gameName }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-white/70 text-sm hidden sm:inline">
            {{ user?.display_name || user?.email }}
          </span>
        </div>
      </div>
    </header>

    <slot />
  </div>
</template>
