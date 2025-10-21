<template>
  <header class="topbar glass">
    <!-- Search Bar -->
    <div class="search-container">
      <div class="search-wrapper" :class="{ 'search-focused': searchFocused }">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search conversations..."
          @focus="searchFocused = true"
          @blur="searchFocused = false"
          @keydown="handleSearchKeydown"
        />
        <kbd class="search-hint" v-if="!searchFocused && !searchQuery">⌘K</kbd>
      </div>
    </div>

    <!-- Right Actions -->
    <div class="topbar-actions">
      <!-- Refresh Button -->
      <button class="icon-btn" title="Refresh" @click="handleRefresh">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M1 4v6h6M19 16v-6h-6M2.51 9a9 9 0 0 1 14.85-3.36L19 8M1 12l1.64 2.36A9 9 0 0 0 17.49 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Last Synced -->
      <span class="last-synced" v-if="lastSynced">{{ lastSyncedText }}</span>

      <!-- Notifications -->
      <button class="icon-btn" title="Notifications">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 6.667A5 5 0 0 0 5 6.667c0 5.833-2.5 7.5-2.5 7.5h15s-2.5-1.667-2.5-7.5zM11.449 18.333a1.667 1.667 0 0 1-2.898 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="notification-badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
      </button>

      <!-- User Menu -->
      <button class="user-btn" @click="showUserMenu = !showUserMenu">
        <div class="user-avatar">
          {{ userInitials }}
        </div>
        <span class="user-name">{{ userName }}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const searchQuery = ref('')
const searchFocused = ref(false)
const showUserMenu = ref(false)
const lastSynced = ref<Date | null>(null)
const unreadCount = ref(0)

const userName = computed(() => authStore.user?.name || 'User')
const userInitials = computed(() => {
  const name = authStore.user?.name || 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

const lastSyncedText = computed(() => {
  if (!lastSynced.value) return ''
  const now = Date.now()
  const diff = now - lastSynced.value.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)

  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  return lastSynced.value.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
})

function handleRefresh() {
  lastSynced.value = new Date()
  // Trigger data refresh
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    searchQuery.value = ''
    ;(event.target as HTMLInputElement).blur()
  }
}

// CMD/CTRL + K to focus search
function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    const searchInput = document.querySelector('.search-input') as HTMLInputElement
    searchInput?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  lastSynced.value = new Date()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  height: var(--topbar-height);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--divider);
}

/* Search Container */
.search-container {
  flex: 1;
  max-width: 640px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  transition: all var(--duration-normal) var(--ease-out);
}

.search-wrapper:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}

.search-focused {
  background: var(--surface-2);
  border-color: var(--accent);
  box-shadow: var(--focus-ring-offset);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: var(--text-base);
  line-height: 1.5;
}

.search-input::placeholder {
  color: var(--text-subtle);
}

.search-hint {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* Actions */
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.icon-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border);
  color: var(--text);
  transform: translateY(-1px);
}

.icon-btn:active {
  transform: translateY(0);
}

.notification-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--error);
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--weight-semibold);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: popIn var(--duration-normal) var(--ease-spring);
}

.last-synced {
  font-size: var(--text-sm);
  color: var(--text-subtle);
  white-space: nowrap;
}

/* User Button */
.user-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.user-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border);
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: white;
}

.user-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text);
}

.chevron {
  color: var(--text-muted);
  transition: transform var(--duration-fast) var(--ease-out);
}

.user-btn:hover .chevron {
  transform: translateY(2px);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .topbar {
    padding: 0 var(--space-4);
  }

  .user-name {
    display: none;
  }

  .last-synced {
    display: none;
  }
}
</style>
