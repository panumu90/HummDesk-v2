<template>
  <div class="app-shell">
    <div class="app-shell__backdrop">
      <span class="backdrop-layer backdrop-layer--left" />
      <span class="backdrop-layer backdrop-layer--center" />
      <span class="backdrop-layer backdrop-layer--right" />
    </div>

    <div class="app-shell__grid">
      <!-- Sidebar -->
      <aside class="app-sidebar">
        <Sidebar />
      </aside>

      <!-- Main Content Area -->
      <main class="app-main">
        <div class="app-main__surface">
          <TopBar />

          <nav class="app-main__navigator" aria-label="Workspace destinations">
            <button
              v-for="item in quickNav"
              :key="item.path"
              type="button"
              class="navigator-pill"
              :class="{ active: isQuickNavActive(item.path) }"
              @click="navigate(item.path)"
            >
              <span class="navigator-pill__label">{{ item.label }}</span>
              <span class="navigator-pill__meta">{{ item.meta }}</span>
            </button>
          </nav>

          <div class="app-content">
            <slot />
          </div>
        </div>
      </main>

      <!-- Assist Panel (hidden on smaller screens) -->
      <aside class="app-assist">
        <AssistPanel />
      </aside>
    </div>

    <!-- AI Copilot - Floating Assistant -->
    <AICopilot @action="handleCopilotAction" />

    <!-- Modals -->
    <AddTeamModal v-model="showAddTeamModal" @created="handleTeamCreated" />
    <AddConversationModal v-model="showAddConversationModal" @created="handleConversationCreated" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AssistPanel from '@/components/layout/AssistPanel.vue'
import AICopilot from '@/components/AICopilot.vue'
import AddTeamModal from '@/components/modals/AddTeamModal.vue'
import AddConversationModal from '@/components/modals/AddConversationModal.vue'

const router = useRouter()
const route = useRoute()

// Modal state management
const showAddTeamModal = ref(false)
const showAddConversationModal = ref(false)

const quickNav = computed(() => [
  {
    path: '/dashboard',
    label: 'Command Center',
    meta: 'Live health across tenants',
  },
  {
    path: '/conversations',
    label: 'Omnichannel Queue',
    meta: 'AI triage & agent routing',
  },
  {
    path: '/knowledge-base',
    label: 'Knowledge Cloud',
    meta: 'Embeddings, playbooks, macros',
  },
  {
    path: '/teams',
    label: 'Human Mesh',
    meta: 'Scheduling, skills, SLAs',
  },
])

function isQuickNavActive(path: string) {
  return route.path.startsWith(path)
}

function navigate(path: string) {
  if (!isQuickNavActive(path)) {
    router.push(path)
  }
}

// AI Copilot action handler
function handleCopilotAction(action: string) {
  switch (action) {
    case 'new_conversation':
      showAddConversationModal.value = true
      break
    case 'add_team':
      showAddTeamModal.value = true
      break
    case 'view_analytics':
      router.push('/analytics')
      break
    case 'team_performance':
      router.push('/teams')
      break
    default:
      console.log('Unknown action:', action)
  }
}

// Team created handler
function handleTeamCreated(team: any) {
  console.log('Team created:', team)
  // TODO: Emit event or call API to add team to store
  router.push('/teams')
}

// Conversation created handler
function handleConversationCreated(conversation: any) {
  console.log('Conversation created:', conversation)
  // TODO: Emit event or call API to add conversation to store
  router.push(`/conversations/${conversation.id}`)
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  isolation: isolate;
}

.app-shell__backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8vw;
  pointer-events: none;
  filter: blur(120px);
  opacity: 0.55;
}

.backdrop-layer {
  border-radius: 48px;
  background: linear-gradient(140deg, rgba(14, 116, 144, 0.4), rgba(15, 23, 42, 0.2));
  animation: backdropFlow 26s ease-in-out infinite;
}

.backdrop-layer--center {
  background: linear-gradient(160deg, rgba(37, 99, 235, 0.38), rgba(14, 165, 233, 0.18));
  animation-delay: -8s;
}

.backdrop-layer--right {
  background: linear-gradient(160deg, rgba(129, 140, 248, 0.35), rgba(15, 23, 42, 0.15));
  animation-delay: -16s;
}

.app-shell__grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, var(--sidebar-width)) minmax(0, 1fr);
  gap: clamp(1.5rem, 3vw, 2.75rem);
  padding: clamp(1.5rem, 3vw, 3rem);
  margin: 0 auto;
  width: min(1680px, 100%);
  align-items: flex-start;
}

.app-sidebar {
  position: relative;
  border-radius: var(--radius-2xl);
  background: rgba(12, 19, 35, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 32px 90px rgba(2, 8, 23, 0.55);
  backdrop-filter: blur(28px);
  overflow: hidden;
  min-height: calc(100vh - clamp(3rem, 6vh, 5rem));
}

.app-main {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.app-main__surface {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 2.5vw, 2.75rem);
  padding: clamp(1.75rem, 2vw, 2.5rem);
  border-radius: var(--radius-2xl);
  background: linear-gradient(160deg, rgba(9, 12, 24, 0.9), rgba(4, 11, 28, 0.78));
  border: 1px solid rgba(148, 163, 184, 0.08);
  box-shadow: 0 32px 90px rgba(2, 8, 23, 0.45);
  backdrop-filter: blur(30px);
  min-height: calc(100vh - clamp(3rem, 6vh, 5rem));
}

.app-main__navigator {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.navigator-pill {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.95rem 1.1rem;
  border-radius: var(--radius-xl);
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(8, 18, 32, 0.72);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-slow) var(--ease-out);
  backdrop-filter: blur(16px);
}

.navigator-pill:hover {
  border-color: rgba(34, 211, 238, 0.45);
  box-shadow: 0 18px 36px rgba(7, 89, 133, 0.35);
  transform: translateY(-2px);
}

.navigator-pill.active {
  border-color: rgba(34, 211, 238, 0.65);
  background: linear-gradient(140deg, rgba(34, 211, 238, 0.18), rgba(59, 130, 246, 0.18));
  box-shadow: 0 20px 44px rgba(37, 99, 235, 0.35);
}

.navigator-pill__label {
  font-size: 0.95rem;
  font-weight: var(--weight-semibold);
}

.navigator-pill__meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.app-content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: var(--radius-2xl);
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(5, 11, 26, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  padding: clamp(1.5rem, 2.4vw, 2.5rem);
}

.app-assist {
  display: none;
  border-radius: var(--radius-2xl);
  background: rgba(8, 15, 30, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 32px 80px rgba(2, 8, 23, 0.45);
  backdrop-filter: blur(28px);
  overflow: hidden;
  min-height: calc(100vh - clamp(3rem, 6vh, 5rem));
}

:deep(.sidebar) {
  height: 100%;
  background: transparent;
}

:deep(.assist-panel) {
  flex: 1;
  background: transparent;
}

@media (min-width: 1280px) {
  .app-shell__grid {
    grid-template-columns: minmax(0, var(--sidebar-width)) minmax(0, 1fr) minmax(320px, var(--assist-width));
  }

  .app-assist {
    display: flex;
    flex-direction: column;
  }
}

@media (max-width: 1024px) {
  .app-shell__grid {
    grid-template-columns: 1fr;
    gap: var(--space-4);
    padding: clamp(1rem, 4vw, 1.75rem);
  }

  .app-sidebar {
    position: fixed;
    inset: clamp(1rem, 4vw, 1.75rem) auto clamp(1rem, 4vw, 1.75rem) clamp(1rem, 4vw, 1.75rem);
    width: min(280px, calc(100% - clamp(2rem, 10vw, 3.5rem)));
    transform: translateX(-115%);
    transition: transform var(--duration-slow) var(--ease-out);
    z-index: var(--z-modal);
  }

  .app-sidebar.mobile-open {
    transform: translateX(0);
  }

  .app-main__surface {
    padding: var(--space-4);
    min-height: auto;
  }

  .app-main__navigator {
    grid-template-columns: 1fr;
  }

  .app-content {
    border-radius: var(--radius-xl);
  }
}

@keyframes backdropFlow {
  0%,
  100% {
    transform: translateY(-80px) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-10px) scale(1.08);
    opacity: 0.85;
  }
}
</style>
