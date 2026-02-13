<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Theme Toggle -->
    <div class="flex justify-end p-4">
      <ThemeToggle />
    </div>

    <!-- Auth checking state -->
    <div v-if="authChecking" class="flex justify-center items-center h-screen">
      <div class="text-center text-(--ui-text-muted)">
        <UIcon name="i-lucide-loader-2" class="size-10 animate-spin mb-4" />
        <p>Loading...</p>
      </div>
    </div>

    <!-- Not logged in - show landing page -->
    <div v-else-if="!isLoggedIn" class="text-center py-16 px-4">
      <h1 class="text-4xl font-bold text-(--ui-text) mb-4">Welcome</h1>
      <p class="text-(--ui-text-muted) mb-8 max-w-lg mx-auto">
        Get started by creating an account or signing in.
      </p>
      <div class="flex gap-4 justify-center">
        <UButton to="/register" size="lg">
          Get Started
        </UButton>
        <UButton to="/login" size="lg" variant="outline">
          Sign In
        </UButton>
      </div>
    </div>

    <!-- Logged in - redirect to dashboard -->
    <div v-else-if="isLoggedIn" class="flex justify-center items-center h-screen">
      <div class="text-center text-(--ui-text-muted)">
        <UIcon name="i-lucide-loader-2" class="size-10 animate-spin mb-4" />
        <p>Redirecting...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})

const { isLoggedIn, checkAuth } = useAuth()
const router = useRouter()

// Auth loading state
const authChecking = ref(true)

// Check auth on mount
onMounted(async () => {
  const authResult = await checkAuth()
  authChecking.value = false

  if (authResult) {
    // User is logged in, redirect to dashboard
    await router.push('/dashboard')
  }

  // If not logged in, landing page will show automatically
})
</script>
