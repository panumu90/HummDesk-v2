<template>
  <button
    class="conversation-card"
    :class="{ selected, unread: conversation.unread_count > 0 }"
    @click="$emit('select', conversation.id)"
  >
    <!-- Avatar -->
    <div class="avatar-container">
      <div class="avatar" :style="{ background: avatarGradient }">
        {{ initials }}
      </div>
      <div v-if="conversation.unread_count > 0" class="unread-indicator pop-in">
        {{ conversation.unread_count }}
      </div>
    </div>

    <!-- Content -->
    <div class="card-content">
      <!-- Title Row -->
      <div class="title-row">
        <div class="title-group">
          <h3 class="customer-name">{{ conversation.customer_name }}</h3>
          <span v-if="conversation.client_name" class="client-name">
            · {{ conversation.client_name }}
          </span>
        </div>
        <span class="timestamp">{{ formattedTime }}</span>
      </div>

      <!-- Message Snippet -->
      <p class="message-snippet">{{ conversation.last_message }}</p>

      <!-- Meta Row -->
      <div class="meta-row">
        <StatusChip :status="conversation.status" />
        <AssigneePill v-if="conversation.assignee" :assignee="conversation.assignee" />
        <TeamBadge v-if="conversation.team" :team="conversation.team" />
        <BreachBadge v-if="isBreachRisk" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusChip from './StatusChip.vue'
import AssigneePill from './AssigneePill.vue'
import TeamBadge from './TeamBadge.vue'
import BreachBadge from './BreachBadge.vue'

interface Conversation {
  id: string
  customer_name: string
  client_name?: string
  last_message: string
  status: 'open' | 'pending' | 'resolved'
  unread_count: number
  created_at: string
  assignee?: {
    id: string
    name: string
    avatar_url?: string
  }
  team?: {
    id: string
    name: string
    color: string
  }
  sla_breach_at?: string
}

interface Props {
  conversation: Conversation
  selected?: boolean
}

const props = defineProps<Props>()
defineEmits(['select'])

const initials = computed(() => {
  const name = props.conversation.customer_name
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const avatarGradient = computed(() => {
  // Generate consistent color based on customer name
  const hash = props.conversation.customer_name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  const hue = Math.abs(hash % 360)
  return `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${hue + 30}, 70%, 55%))`
})

const formattedTime = computed(() => {
  const date = new Date(props.conversation.created_at)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const isBreachRisk = computed(() => {
  if (!props.conversation.sla_breach_at) return false
  const breachTime = new Date(props.conversation.sla_breach_at)
  const now = new Date()
  const diffMins = (breachTime.getTime() - now.getTime()) / 60000
  return diffMins < 60 && diffMins > 0 // Less than 1 hour to breach
})
</script>

<style scoped>
.conversation-card {
  width: 100%;
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.conversation-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-xl);
  padding: 1px;
  background: linear-gradient(135deg, transparent, rgba(34, 211, 238, 0));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.conversation-card:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
  transform: translateY(-2px) scale(1.01);
  box-shadow: var(--shadow-md);
}

.conversation-card:hover::before {
  opacity: 1;
}

.conversation-card:active {
  transform: translateY(-1px) scale(1.005);
}

.conversation-card.selected {
  background: var(--surface-2);
  border-color: var(--accent);
  box-shadow: var(--focus-ring-offset);
}

.conversation-card.selected::before {
  background: linear-gradient(135deg, var(--accent), var(--primary));
  opacity: 1;
}

.conversation-card.unread {
  border-left: 3px solid var(--accent);
}

/* Avatar */
.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: white;
  box-shadow: 0 0 0 2px var(--surface), var(--shadow-sm);
}

.unread-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--error);
  border: 2px solid var(--surface);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--weight-bold);
  color: white;
  box-shadow: var(--shadow-sm);
}

/* Content */
.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.client-name {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timestamp {
  flex-shrink: 0;
  font-size: var(--text-sm);
  color: var(--text-subtle);
}

.message-snippet {
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--text-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Animations */
@media (prefers-reduced-motion: no-preference) {
  .conversation-card {
    animation: fadeIn var(--duration-slow) var(--ease-out);
  }
}
</style>
