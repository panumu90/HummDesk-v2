<template>
  <div id="app" class="app-root">
    <NeuralBackground />

    <div class="app-foreground">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import NeuralBackground from '@/components/background/NeuralBackground.vue'

const authStore = useAuthStore()

onMounted(() => {
  // Initialize auth from localStorage
  authStore.initializeAuth()
})
</script>

<style scoped>
.app-root {
  position: relative;
  min-height: 100vh;
  background: radial-gradient(circle at 15% 15%, rgba(30, 64, 175, 0.45), rgba(8, 17, 35, 0.92) 50%),
    radial-gradient(circle at 85% 20%, rgba(13, 148, 136, 0.25), rgba(8, 17, 35, 0.9) 55%),
    #050a1a;
  overflow: hidden;
}

.app-foreground {
  position: relative;
  z-index: 2;
  min-height: 100vh;
}
</style>
