<template>
  <AppShell>
    <div class="conversations-view">
      <!-- Conversations List -->
      <div class="conversations-list">
        <div class="list-header">
          <h2 class="list-title">Conversations</h2>
          <div class="list-actions">
            <button class="filter-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
              All
            </button>
            <button class="filter-btn" :class="{ active: filter === 'mine' }" @click="filter = 'mine'">
              Mine
            </button>
            <button class="filter-btn" :class="{ active: filter === 'unassigned' }" @click="filter = 'unassigned'">
              Unassigned
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="conversationsStore.loading" class="empty-state">
          <div class="shimmer-cards">
            <div class="shimmer-card shimmer" v-for="n in 5" :key="n"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredConversations.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M48 16H16a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h8l8 8 8-8h8a4 4 0 0 0 4-4V20a4 4 0 0 0-4-4z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M24 28h16M24 36h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </div>
          <h3 class="empty-title">No Conversations</h3>
          <p class="empty-description">New conversations will appear here</p>
        </div>

        <!-- Conversations Cards -->
        <div v-else class="cards-container">
          <ConversationCard
            v-for="conversation in filteredConversations"
            :key="conversation.id"
            :conversation="transformConversation(conversation)"
            :selected="selectedId === conversation.id"
            @select="handleSelect"
          />
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore, type Conversation } from '@/stores/conversations'
import AppShell from '@/layouts/AppShell.vue'
import ConversationCard from '@/components/ConversationCard.vue'

const router = useRouter()
const conversationsStore = useConversationsStore()

const filter = ref<'all' | 'mine' | 'unassigned'>('all')
const selectedId = ref<string | null>(null)

const filteredConversations = computed(() => {
  const conversations = conversationsStore.conversations

  switch (filter.value) {
    case 'mine':
      return conversations.filter(c => c.assignee?.id === 'current-user')
    case 'unassigned':
      return conversations.filter(c => !c.assignee)
    default:
      return conversations
  }
})

// Transform Conversation to match ConversationCard props
function transformConversation(conv: Conversation) {
  return {
    id: conv.id,
    customer_name: conv.customerName,
    client_name: undefined,
    last_message: getLastMessage(conv),
    status: conv.status as 'open' | 'pending' | 'resolved',
    unread_count: 0, // TODO: implement unread tracking
    created_at: conv.updatedAt.toISOString(),
    assignee: conv.assignee,
    team: conv.classification?.assignedTeam ? {
      id: conv.classification.assignedTeam,
      name: conv.classification.assignedTeam,
      color: getTeamColor(conv.classification.assignedTeam)
    } : undefined,
    sla_breach_at: undefined // TODO: implement SLA tracking
  }
}

function getLastMessage(conversation: Conversation): string {
  if (conversation.messages.length === 0) return 'No messages yet'
  return conversation.messages[conversation.messages.length - 1].content
}

function getTeamColor(team: string): string {
  const colors: Record<string, string> = {
    'Billing Team': '#22C55E',
    'Technical Support': '#3B82F6',
    'Sales Team': '#F59E0B'
  }
  return colors[team] || '#60A5FA'
}

function handleSelect(id: string) {
  selectedId.value = id
  router.push(`/conversations/${id}`)
}

onMounted(() => {
  conversationsStore.initializeWebSocket()
  conversationsStore.fetchConversations()
})

onUnmounted(() => {
  conversationsStore.disconnectWebSocket()
})
</script>

<style scoped>
.conversations-view {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  overflow: hidden;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.list-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--divider);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.list-title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.list-actions {
  display: flex;
  gap: var(--space-1);
  background: var(--surface);
  padding: var(--space-1);
  border-radius: var(--radius-lg);
  border: 1px solid var(--divider);
}

.filter-btn {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-btn:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.cards-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-2xl);
  color: var(--text-subtle);
  margin-bottom: var(--space-6);
}

.empty-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-muted);
  margin: 0;
}

/* Shimmer Loading */
.shimmer-cards {
  width: 100%;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shimmer-card {
  height: 120px;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .list-header {
    flex-direction: column;
    align-items: stretch;
  }

  .list-actions {
    width: 100%;
  }

  .filter-btn {
    flex: 1;
  }
}
</style>
