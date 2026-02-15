<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user } = useAuth()

interface AdminUser {
  id: string
  email: string
  display_name: string
  verified: boolean
  superadmin: boolean
  created: string
}

const users = ref<AdminUser[]>([])
const loading = ref(true)
const error = ref('')
const deleteConfirm = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ users: AdminUser[] }>('/api/admin/users')
    users.value = data.users
  } catch (err: any) {
    if (err.statusCode === 403) {
      navigateTo('/dashboard')
      return
    }
    error.value = err.data?.statusMessage || 'Failed to load users'
  } finally {
    loading.value = false
  }
})

async function toggleVerified(u: AdminUser) {
  try {
    const data = await $fetch<{ user: AdminUser }>(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: { verified: !u.verified }
    })
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = data.user
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to update user'
  }
}

async function deleteUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    users.value = users.value.filter(u => u.id !== id)
    deleteConfirm.value = null
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to delete user'
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <h1 class="text-3xl font-bold">User Management</h1>

    <UAlert v-if="error" color="error" :title="error" />

    <UCard>
      <div v-if="loading" class="text-center py-8 text-(--ui-text-muted)">
        Loading users...
      </div>

      <UTable
        v-else
        :data="users"
        :columns="[
          { id: 'display_name', accessorKey: 'display_name', header: 'Name' },
          { id: 'email', accessorKey: 'email', header: 'Email' },
          { id: 'verified', accessorKey: 'verified', header: 'Verified' },
          { id: 'created', accessorKey: 'created', header: 'Created' },
          { id: 'actions', header: '' }
        ]"
      >
        <template #verified-cell="{ row }">
          <UBadge :color="row.original.verified ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.verified ? 'Verified' : 'Unverified' }}
          </UBadge>
        </template>

        <template #created-cell="{ row }">
          {{ new Date(row.original.created).toLocaleDateString() }}
        </template>

        <template #actions-cell="{ row }">
          <div class="flex gap-2 justify-end">
            <UButton
              size="xs"
              :color="row.original.verified ? 'neutral' : 'success'"
              variant="soft"
              @click="toggleVerified(row.original)"
            >
              {{ row.original.verified ? 'Unverify' : 'Verify' }}
            </UButton>

            <template v-if="row.original.id !== user?.id">
              <UButton
                v-if="deleteConfirm !== row.original.id"
                size="xs"
                color="error"
                variant="soft"
                @click="deleteConfirm = row.original.id"
              >
                Delete
              </UButton>
              <div v-else class="flex gap-1">
                <UButton size="xs" color="error" @click="deleteUser(row.original.id)">
                  Confirm
                </UButton>
                <UButton size="xs" variant="ghost" @click="deleteConfirm = null">
                  Cancel
                </UButton>
              </div>
            </template>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
