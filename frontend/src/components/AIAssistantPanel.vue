<template>
  <div class="ai-assistant-panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-content">
        <div class="ai-icon-wrapper">
          <div class="ai-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <div>
            <h3 class="panel-title">AI Assistant</h3>
            <p class="panel-subtitle">Powered by Claude Sonnet 4.5</p>
          </div>
        </div>
        <div class="header-actions">
          <button
            v-if="capabilities.length > 0"
            @click="showCapabilities = !showCapabilities"
            class="icon-btn"
            title="View capabilities"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </button>
          <button @click="$emit('close')" class="icon-btn" title="Close panel">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Capabilities List (Collapsible) -->
      <transition name="slide-down">
        <div v-if="showCapabilities" class="capabilities-panel">
          <h4 class="capabilities-title">Available Skills</h4>
          <div class="capabilities-list">
            <div v-for="cap in capabilities" :key="cap.name" class="capability-item">
              <div class="capability-icon">🔧</div>
              <div class="capability-info">
                <span class="capability-name">{{ cap.name }}</span>
                <span class="capability-desc">{{ cap.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Chat Messages -->
    <div class="chat-container" ref="chatContainer">
      <div class="chat-messages">
        <!-- Welcome Message -->
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="welcome-icon">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <h4>How can I assist you?</h4>
          <p class="welcome-text">
            I can help you with:
          </p>
          <ul class="welcome-list">
            <li>Searching knowledge base articles</li>
            <li>Looking up customer data in HubSpot</li>
            <li>Checking order status</li>
            <li>Finding related conversations</li>
            <li>Creating tickets and tasks</li>
          </ul>
          <div class="quick-prompts">
            <button
              v-for="prompt in quickPrompts"
              :key="prompt"
              @click="sendQuickPrompt(prompt)"
              class="quick-prompt-btn"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <!-- Message List -->
        <div v-for="(msg, index) in messages" :key="index" class="message-wrapper" :class="`message-${msg.role}`">
          <!-- User Message -->
          <div v-if="msg.role === 'user'" class="message user-message">
            <div class="message-content">
              {{ msg.content }}
            </div>
            <div class="message-avatar">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
              </svg>
            </div>
          </div>

          <!-- Assistant Message -->
          <div v-else class="message assistant-message">
            <div class="message-avatar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <div class="message-content">
              <!-- Tool Use Visualization -->
              <div v-if="msg.tool_uses && msg.tool_uses.length > 0" class="tool-uses">
                <div v-for="(tool, toolIndex) in msg.tool_uses" :key="toolIndex" class="tool-use-card">
                  <div class="tool-header">
                    <div class="tool-icon">🔧</div>
                    <span class="tool-name">{{ tool.name }}</span>
                    <div class="tool-status" :class="tool.status || 'completed'">
                      <span class="status-dot"></span>
                      {{ tool.status || 'completed' }}
                    </div>
                  </div>
                  <div v-if="tool.input" class="tool-details">
                    <pre class="tool-input">{{ JSON.stringify(tool.input, null, 2) }}</pre>
                  </div>
                  <div v-if="tool.result" class="tool-result">
                    <strong>Result:</strong>
                    <p>{{ tool.result }}</p>
                  </div>
                </div>
              </div>

              <!-- Assistant Text Response -->
              <div v-if="msg.content" class="assistant-text">
                {{ msg.content }}
              </div>

              <!-- Thinking Indicator -->
              <div v-if="msg.thinking" class="thinking-indicator">
                <div class="thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="thinking-text">{{ msg.thinking }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isLoading" class="message-wrapper message-assistant">
          <div class="message assistant-message">
            <div class="message-avatar">
              <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
            <div class="message-content">
              <div class="thinking-indicator">
                <div class="thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="thinking-text">Thinking...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="error-message">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{{ error }}</span>
          <button @click="error = null" class="error-close">×</button>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input-container">
      <form @submit.prevent="sendMessage" class="chat-input-form">
        <textarea
          v-model="inputMessage"
          ref="chatInput"
          placeholder="Ask me anything..."
          class="chat-textarea"
          rows="1"
          @input="adjustTextareaHeight"
          @keydown.enter.exact.prevent="sendMessage"
          :disabled="isLoading"
        ></textarea>
        <button
          type="submit"
          class="send-btn"
          :disabled="!inputMessage.trim() || isLoading"
        >
          <svg v-if="!isLoading" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
          <svg v-else class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tool_uses?: ToolUse[];
  thinking?: string;
}

interface ToolUse {
  name: string;
  input?: any;
  result?: string;
  status?: 'running' | 'completed' | 'failed';
}

interface Capability {
  name: string;
  description: string;
  parameters?: any;
}

const props = defineProps<{
  conversationId?: string;
  customerEmail?: string;
  conversationContext?: any;
}>();

const emit = defineEmits(['close']);

// State
const messages = ref<Message[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const error = ref<string | null>(null);
const showCapabilities = ref(false);
const capabilities = ref<Capability[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const chatInput = ref<HTMLTextAreaElement | null>(null);

const quickPrompts = [
  "Search knowledge base for return policy",
  "Look up this customer in HubSpot",
  "Find similar conversations",
  "Generate a response draft"
];

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Load capabilities on mount
onMounted(async () => {
  await loadCapabilities();
});

async function loadCapabilities() {
  try {
    const response = await axios.get(`${API_BASE}/api/v1/agent/capabilities`);
    if (response.data.success) {
      capabilities.value = response.data.data.capabilities;
    }
  } catch (err) {
    console.error('Failed to load capabilities:', err);
  }
}

async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMessage = inputMessage.value.trim();
  inputMessage.value = '';

  // Add user message
  messages.value.push({
    role: 'user',
    content: userMessage
  });

  isLoading.value = true;
  error.value = null;

  // Scroll to bottom
  await nextTick();
  scrollToBottom();

  try {
    // Build context from conversation
    const context = {
      conversation_id: props.conversationId,
      customer_email: props.customerEmail,
      ...props.conversationContext
    };

    // Get conversation history for context
    const conversation_history = messages.value.slice(0, -1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await axios.post(`${API_BASE}/api/v1/agent/chat`, {
      message: userMessage,
      conversation_history,
      context
    });

    if (response.data.success) {
      const data = response.data.data;

      // Add assistant message with tool uses
      messages.value.push({
        role: 'assistant',
        content: data.response || data.final_response,
        tool_uses: data.tool_uses || []
      });

      scrollToBottom();
    } else {
      throw new Error(response.data.message || 'Failed to get response');
    }
  } catch (err: any) {
    console.error('Chat error:', err);
    error.value = err.response?.data?.message || err.message || 'Failed to send message';
  } finally {
    isLoading.value = false;
  }
}

function sendQuickPrompt(prompt: string) {
  inputMessage.value = prompt;
  sendMessage();
}

function adjustTextareaHeight() {
  const textarea = chatInput.value;
  if (!textarea) return;

  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      const scrollElement = chatContainer.value;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  });
}

// Watch for conversation changes to reset context
watch(() => props.conversationId, () => {
  messages.value = [];
  error.value = null;
});
</script>

<style scoped>
.ai-assistant-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(148, 163, 184, 0.1);
}

/* Header */
.panel-header {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.ai-icon-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ai-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: white;
  margin: 0;
}

.panel-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Capabilities Panel */
.capabilities-panel {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.capabilities-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.capabilities-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.capability-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.capability-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.capability-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.capability-name {
  font-size: 13px;
  font-weight: 600;
  color: white;
  font-family: 'Courier New', monospace;
}

.capability-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Chat Container */
.chat-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.chat-messages {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Welcome Message */
.welcome-message {
  text-align: center;
  padding: 40px 20px;
  color: #cbd5e1;
}

.welcome-icon {
  display: inline-flex;
  padding: 16px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 50%;
  color: #667eea;
  margin-bottom: 16px;
}

.welcome-message h4 {
  font-size: 18px;
  font-weight: 700;
  color: white;
  margin: 0 0 8px 0;
}

.welcome-text {
  font-size: 14px;
  margin: 16px 0 12px 0;
}

.welcome-list {
  text-align: left;
  max-width: 300px;
  margin: 0 auto 20px;
  padding-left: 24px;
  font-size: 13px;
  line-height: 1.8;
  color: #94a3b8;
}

.quick-prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.quick-prompt-btn {
  padding: 10px 16px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.quick-prompt-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: #667eea;
  color: white;
}

/* Messages */
.message-wrapper {
  display: flex;
}

.message-wrapper.message-user {
  justify-content: flex-end;
}

.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.user-message {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-message .message-avatar {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.assistant-message .message-avatar {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.message-content {
  flex: 1;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.user-message .message-content {
  background: rgba(59, 130, 246, 0.15);
  color: #e0e7ff;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.assistant-message .message-content {
  background: rgba(30, 41, 59, 0.6);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.1);
}

/* Tool Use Cards */
.tool-uses {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.tool-use-card {
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-icon {
  font-size: 16px;
}

.tool-name {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #a78bfa;
}

.tool-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #22c55e;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tool-details {
  margin-top: 8px;
}

.tool-input {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 6px;
  color: #94a3b8;
  overflow-x: auto;
}

.tool-result {
  margin-top: 8px;
  font-size: 13px;
  color: #cbd5e1;
}

.tool-result strong {
  color: #a78bfa;
}

/* Thinking Indicator */
.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 13px;
}

.thinking-dots {
  display: flex;
  gap: 4px;
}

.thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: thinking 1.4s infinite;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 13px;
}

.error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
}

/* Input Area */
.chat-input-container {
  flex-shrink: 0;
  padding: 16px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.95);
}

.chat-input-form {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.chat-textarea {
  flex: 1;
  padding: 12px 16px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  overflow-y: auto;
  transition: all 0.2s;
}

.chat-textarea:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(30, 41, 59, 0.8);
}

.chat-textarea::placeholder {
  color: #64748b;
}

.chat-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Scrollbar Styling */
.chat-container::-webkit-scrollbar,
.capabilities-list::-webkit-scrollbar {
  width: 6px;
}

.chat-container::-webkit-scrollbar-track,
.capabilities-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.chat-container::-webkit-scrollbar-thumb,
.capabilities-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.chat-container::-webkit-scrollbar-thumb:hover,
.capabilities-list::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}
</style>
