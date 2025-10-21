<template>
  <AppShell>
    <div class="conversation-detail">
      <!-- Header -->
      <div class="conversation-header">
        <div class="header-left">
          <button class="back-btn" @click="router.back()">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-8 6 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="conversation" class="customer-info">
            <div class="customer-avatar">
              {{ getInitials(conversation.customerName) }}
            </div>
            <div>
              <h1 class="customer-name">{{ conversation.customerName }}</h1>
              <p class="customer-email">{{ conversation.customerEmail }}</p>
            </div>
          </div>
        </div>

        <div v-if="conversation" class="header-right">
          <!-- AI Classification -->
          <div v-if="conversation.classification" class="classification-pills">
            <div class="pill pill-category">
              <span class="pill-label">{{ conversation.classification.category }}</span>
            </div>
            <div class="pill" :class="`pill-${conversation.classification.priority}`">
              <span class="pill-label">{{ conversation.classification.priority }}</span>
            </div>
            <div class="pill pill-sentiment">
              <span class="pill-label">{{ conversation.classification.sentiment }}</span>
            </div>
          </div>

          <!-- Status Selector -->
          <select
            v-model="conversation.status"
            @change="updateStatus"
            class="status-select"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="messages-container">
        <div ref="messagesScroll" class="messages-scroll">
          <div v-if="!conversation" class="loading-state">
            <div class="shimmer-messages">
              <div class="shimmer-message" v-for="n in 4" :key="n"></div>
            </div>
          </div>

          <div v-else class="messages-list">
            <div
              v-for="message in conversation.messages"
              :key="message.id"
              class="message-row"
              :class="message.sender === 'customer' ? 'message-incoming' : 'message-outgoing'"
            >
              <div class="message-bubble">
                <p class="message-content">{{ message.content }}</p>
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div class="message-input-container">
          <form @submit.prevent="sendMessage" class="message-input-form">
            <div class="input-wrapper">
              <textarea
                v-model="newMessage"
                ref="messageInput"
                placeholder="Type your message..."
                class="message-textarea"
                rows="1"
                @input="adjustTextareaHeight"
                @keydown.enter.exact.prevent="sendMessage"
              ></textarea>
            </div>
            <div class="input-actions">
              <button
                v-if="conversation?.aiDraft"
                @click="useAIDraft"
                type="button"
                class="btn-draft"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Use AI Draft
              </button>
              <button type="submit" class="btn-send" :disabled="!newMessage.trim()">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M18 2L9 11M18 2l-6 16-3-7-7-3 16-6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- AI Draft Panel (Right Sidebar) -->
      <div v-if="conversation?.aiDraft && showDraftPanel" class="draft-panel">
        <div class="draft-header">
          <h2 class="draft-title">AI Draft</h2>
          <button class="close-panel-btn" @click="showDraftPanel = false">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M14 6l-8 8M6 6l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="draft-content">
          <!-- Confidence Score -->
          <div class="confidence-card">
            <div class="confidence-header">
              <span class="confidence-label">Confidence</span>
              <span class="confidence-value">{{ Math.round(conversation.aiDraft.confidence * 100) }}%</span>
            </div>
            <div class="confidence-bar">
              <div
                class="confidence-fill"
                :class="getConfidenceClass(conversation.aiDraft.confidence)"
                :style="{ width: `${conversation.aiDraft.confidence * 100}%` }"
              ></div>
            </div>
          </div>

          <!-- Draft Content -->
          <div class="draft-card">
            <h3 class="card-title">Suggested Response</h3>
            <p class="draft-text">{{ conversation.aiDraft.content }}</p>
            <div class="draft-actions">
              <button class="btn-secondary" @click="editDraft">Edit</button>
              <button class="btn-primary" @click="useAIDraft">Use Draft</button>
            </div>
          </div>

          <!-- Reasoning -->
          <div class="draft-card">
            <h3 class="card-title">AI Reasoning</h3>
            <p class="reasoning-text">{{ conversation.aiDraft.reasoning }}</p>
          </div>

          <!-- Suggested Actions -->
          <div v-if="conversation.aiDraft.suggestedActions?.length" class="draft-card">
            <h3 class="card-title">Suggested Actions</h3>
            <ul class="actions-list">
              <li v-for="(action, index) in conversation.aiDraft.suggestedActions" :key="index" class="action-item">
                <svg class="action-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 5L6 12 3 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ action }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Toggle Draft Panel Button (when collapsed) -->
      <button
        v-if="conversation?.aiDraft && !showDraftPanel"
        class="toggle-draft-btn"
        @click="showDraftPanel = true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Show AI Draft
      </button>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore, type Conversation } from '@/stores/conversations'
import AppShell from '@/layouts/AppShell.vue'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const conversationsStore = useConversationsStore()

const conversation = ref<Conversation | null>(null)
const newMessage = ref('')
const messagesScroll = ref<HTMLElement | null>(null)
const messageInput = ref<HTMLTextAreaElement | null>(null)
const showDraftPanel = ref(true)

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.9) return 'high'
  if (confidence >= 0.7) return 'medium'
  return 'low'
}

async function sendMessage() {
  if (!newMessage.value.trim() || !conversation.value) return

  await conversationsStore.sendMessage(conversation.value.id, newMessage.value)
  newMessage.value = ''
  scrollToBottom()
  resetTextareaHeight()
}

function useAIDraft() {
  if (conversation.value?.aiDraft) {
    newMessage.value = conversation.value.aiDraft.content
    messageInput.value?.focus()
  }
}

function editDraft() {
  useAIDraft()
  // TODO: Implement draft editing mode
}

async function updateStatus() {
  if (conversation.value) {
    await conversationsStore.updateConversationStatus(
      conversation.value.id,
      conversation.value.status
    )
  }
}

function adjustTextareaHeight(event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
}

function resetTextareaHeight() {
  if (messageInput.value) {
    messageInput.value.style.height = 'auto'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesScroll.value) {
      messagesScroll.value.scrollTop = messagesScroll.value.scrollHeight
    }
  })
}

watch(
  () => conversation.value?.messages.length,
  () => {
    scrollToBottom()
  }
)

onMounted(async () => {
  conversation.value = await conversationsStore.fetchConversation(props.id)
  scrollToBottom()
})
</script>

<style scoped>
.conversation-detail {
  display: grid;
  grid-template-columns: 1fr auto;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* Header */
.conversation-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--divider);
  background: var(--surface);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.back-btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.customer-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.customer-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  color: white;
}

.customer-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-1) 0;
}

.customer-email {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.classification-pills {
  display: flex;
  gap: var(--space-2);
}

.pill {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  border: 1px solid;
}

.pill-category {
  background: rgba(34, 211, 238, 0.15);
  color: var(--accent);
  border-color: rgba(34, 211, 238, 0.3);
}

.pill-urgent {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.3);
}

.pill-high {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.3);
}

.pill-medium {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
  border-color: rgba(34, 197, 94, 0.3);
}

.pill-sentiment {
  background: rgba(96, 165, 250, 0.15);
  color: var(--info);
  border-color: rgba(96, 165, 250, 0.3);
}

.status-select {
  padding: var(--space-2) var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.status-select:hover {
  border-color: var(--accent);
}

/* Messages Container */
.messages-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--topbar-height) - 80px);
  overflow: hidden;
}

.messages-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.message-row {
  display: flex;
  animation: fadeIn var(--duration-slow) var(--ease-out);
}

.message-incoming {
  justify-content: flex-start;
}

.message-outgoing {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  position: relative;
}

.message-incoming .message-bubble {
  background: var(--surface);
  border: 1px solid var(--divider);
  border-top-left-radius: var(--radius-sm);
}

.message-outgoing .message-bubble {
  background: var(--primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top-right-radius: var(--radius-sm);
}

.message-content {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
  word-wrap: break-word;
}

.message-time {
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

/* Message Input */
.message-input-container {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--divider);
  background: var(--surface);
}

.message-input-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.input-wrapper {
  position: relative;
}

.message-textarea {
  width: 100%;
  min-height: 44px;
  max-height: 200px;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text);
  font-size: var(--text-base);
  font-family: var(--font-body);
  resize: none;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.message-textarea:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring-offset);
}

.message-textarea::placeholder {
  color: var(--text-subtle);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.btn-draft {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(34, 211, 238, 0.15);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: var(--radius-lg);
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-draft:hover {
  background: rgba(34, 211, 238, 0.25);
  border-color: var(--accent);
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--bg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-send:hover:not(:disabled) {
  background: var(--primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Draft Panel */
.draft-panel {
  width: 420px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--divider);
  background: var(--surface-2);
  overflow-y: auto;
}

.draft-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--divider);
}

.draft-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.close-panel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.close-panel-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.draft-content {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.confidence-card,
.draft-card {
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
}

.confidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.confidence-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-muted);
}

.confidence-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--text);
}

.confidence-bar {
  height: 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-out);
}

.confidence-fill.high {
  background: linear-gradient(90deg, var(--success), #16A34A);
}

.confidence-fill.medium {
  background: linear-gradient(90deg, var(--warning), #D97706);
}

.confidence-fill.low {
  background: linear-gradient(90deg, var(--error), #B91C1C);
}

.card-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-3) 0;
}

.draft-text,
.reasoning-text {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text);
  margin: 0;
}

.draft-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-secondary:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  border: none;
  color: var(--bg);
}

.btn-primary:hover {
  background: var(--primary);
  box-shadow: var(--shadow-md);
}

.actions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.action-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.action-icon {
  flex-shrink: 0;
  color: var(--success);
}

/* Toggle Draft Button */
.toggle-draft-btn {
  position: fixed;
  right: var(--space-6);
  bottom: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-full);
  color: var(--bg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  z-index: var(--z-sticky);
  transition: all var(--duration-fast) var(--ease-out);
}

.toggle-draft-btn:hover {
  background: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

/* Shimmer Loading */
.shimmer-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.shimmer-message {
  height: 80px;
  background: var(--surface);
  border-radius: var(--radius-xl);
  animation: shimmer 2s infinite linear;
}

/* Mobile Responsive */
@media (max-width: 1280px) {
  .draft-panel {
    position: fixed;
    right: 0;
    top: var(--topbar-height);
    bottom: 0;
    z-index: var(--z-modal);
    box-shadow: var(--shadow-xl);
  }

  .conversation-detail {
    grid-template-columns: 1fr;
  }
}
</style>
