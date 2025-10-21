<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-card max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2">HummDesk v2</h1>
        <p class="text-white/70">AI-Powered Customer Service Platform</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium mb-2">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="input-glass"
            placeholder="test@test.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-2">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="input-glass"
            placeholder="••••••••"
          />
        </div>

        <div v-if="authStore.error" class="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm">
          {{ authStore.error }}
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="btn-primary w-full"
        >
          <span v-if="!authStore.loading">Sign In</span>
          <span v-else>Signing in...</span>
        </button>
      </form>

      <div class="mt-6 pt-6 border-t border-white/10">
        <p class="text-sm text-white/50 text-center">
          Demo credentials: test@test.com / password123
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('test@test.com')
const password = ref('password123')

async function handleLogin() {
  const success = await authStore.login(email.value, password.value)
  if (success) {
    const redirect = route.query.redirect as string || '/conversations'
    router.push(redirect)
  }
}
</script>
