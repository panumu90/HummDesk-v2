<template>
  <div class="ai-copilot">
    <!-- Floating AI Assistant Button -->
    <button
      v-if="!isOpen"
      @click="toggleCopilot"
      class="copilot-trigger"
      :class="{ 'has-suggestion': hasSuggestions }"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
      </svg>
      <span v-if="hasSuggestions" class="notification-dot"></span>
    </button>

    <!-- AI Copilot Panel -->
    <div v-if="isOpen" class="copilot-panel">
      <!-- Header -->
      <div class="copilot-header">
        <div class="flex items-center gap-2">
          <div class="ai-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white">AI Copilot</h3>
          <span class="status-badge">Active</span>
        </div>
        <button @click="toggleCopilot" class="close-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Suggestions Section -->
      <div class="copilot-content">
        <!-- Current Context -->
        <div v-if="currentContext" class="context-card">
          <div class="context-header">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Current Context</span>
          </div>
          <p class="context-text">{{ currentContext }}</p>
        </div>

        <!-- Proactive Suggestions -->
        <div class="suggestions-section">
          <h4 class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Suggestions for You
          </h4>

          <div class="suggestions-list">
            <div
              v-for="suggestion in suggestions"
              :key="suggestion.id"
              class="suggestion-card"
              :class="`priority-${suggestion.priority}`"
            >
              <div class="suggestion-icon">
                <component :is="getSuggestionIcon(suggestion.type)" class="w-5 h-5" />
              </div>
              <div class="suggestion-content">
                <h5 class="suggestion-title">{{ suggestion.title }}</h5>
                <p class="suggestion-description">{{ suggestion.description }}</p>
                <div class="suggestion-actions">
                  <button
                    v-for="action in suggestion.actions"
                    :key="action.label"
                    @click="executeAction(action)"
                    class="action-btn"
                    :class="action.primary ? 'primary' : 'secondary'"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </div>
              <button @click="dismissSuggestion(suggestion.id)" class="dismiss-btn">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="suggestions.length === 0" class="empty-state">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <p>All caught up! No suggestions at the moment.</p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions-section">
          <h4 class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Quick Actions
          </h4>
          <div class="quick-actions-grid">
            <button
              v-for="action in quickActions"
              :key="action.id"
              @click="executeQuickAction(action)"
              class="quick-action-btn"
            >
              <component :is="action.icon" class="w-5 h-5" />
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>

        <!-- Insights -->
        <div class="insights-section">
          <h4 class="section-title">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Insights
          </h4>
          <div class="insights-grid">
            <div v-for="insight in insights" :key="insight.id" class="insight-card">
              <div class="insight-value">{{ insight.value }}</div>
              <div class="insight-label">{{ insight.label }}</div>
              <div class="insight-trend" :class="insight.trend">
                <svg v-if="insight.trend === 'up'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                </svg>
                <svg v-else class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
                <span>{{ insight.change }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue';

interface Suggestion {
  id: string;
  type: 'urgent' | 'recommendation' | 'insight' | 'warning';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actions: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
}

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  action: string;
}

interface Insight {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down';
  change: string;
}

const isOpen = ref(false);
const currentContext = ref<string | null>(null);
const suggestions = ref<Suggestion[]>([]);
const quickActions = ref<QuickAction[]>([]);
const insights = ref<Insight[]>([]);

const hasSuggestions = computed(() => suggestions.value.length > 0);

// Initialize copilot
onMounted(() => {
  loadSuggestions();
  loadQuickActions();
  loadInsights();
  startProactiveMonitoring();
});

let monitoringInterval: number;

function startProactiveMonitoring() {
  // Check for new suggestions every 30 seconds
  monitoringInterval = window.setInterval(() => {
    loadSuggestions();
  }, 30000);
}

onUnmounted(() => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
});

function loadSuggestions() {
  // Mock suggestions - in production, fetch from AI backend
  suggestions.value = [
    {
      id: '1',
      type: 'urgent',
      priority: 'high',
      title: 'High Priority Customer Waiting',
      description: 'Enterprise customer John Doe has been waiting 15 minutes. Response SLA breach in 5 minutes.',
      actions: [
        { label: 'View Conversation', action: 'view_conversation', primary: true },
        { label: 'Assign to Me', action: 'assign_to_me' },
      ],
    },
    {
      id: '2',
      type: 'recommendation',
      priority: 'medium',
      title: 'Similar Issue Detected',
      description: 'This customer\'s issue matches 3 recent cases. Knowledge base article KB-123 might help.',
      actions: [
        { label: 'View Article', action: 'view_kb_article', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ],
    },
    {
      id: '3',
      type: 'insight',
      priority: 'low',
      title: 'Customer Context Available',
      description: 'HubSpot data shows this is a premium customer with €50k ARR. Consider priority handling.',
      actions: [
        { label: 'View HubSpot Data', action: 'view_hubspot', primary: true },
      ],
    },
  ];
}

function loadQuickActions() {
  quickActions.value = [
    {
      id: '1',
      label: 'New Conversation',
      icon: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4v16m8-8H4' })
      ]),
      action: 'new_conversation',
    },
    {
      id: '2',
      label: 'Add Team Member',
      icon: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' })
      ]),
      action: 'add_team_member',
    },
    {
      id: '3',
      label: 'Search KB',
      icon: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' })
      ]),
      action: 'search_kb',
    },
    {
      id: '4',
      label: 'View Analytics',
      icon: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
      ]),
      action: 'view_analytics',
    },
  ];
}

function loadInsights() {
  insights.value = [
    { id: '1', label: 'Avg Response Time', value: '2.3m', trend: 'down', change: '12%' },
    { id: '2', label: 'CSAT Score', value: '4.8', trend: 'up', change: '5%' },
    { id: '3', label: 'SLA Compliance', value: '94%', trend: 'up', change: '3%' },
    { id: '4', label: 'Open Tickets', value: '23', trend: 'down', change: '8%' },
  ];
}

function toggleCopilot() {
  isOpen.value = !isOpen.value;
}

function getSuggestionIcon(type: string) {
  const icons = {
    urgent: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' })
    ]),
    recommendation: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' })
    ]),
    insight: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
    ]),
    warning: h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
    ]),
  };
  return icons[type as keyof typeof icons] || icons.insight;
}

function executeAction(action: any) {
  console.log('Executing action:', action.action);
  // Emit event to parent or navigate
  emit('action', action.action);
}

function dismissSuggestion(id: string) {
  suggestions.value = suggestions.value.filter(s => s.id !== id);
}

function executeQuickAction(action: QuickAction) {
  console.log('Quick action:', action.action);
  emit('quickAction', action.action);
}

const emit = defineEmits(['action', 'quickAction']);
</script>

<style scoped>
.ai-copilot {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

.copilot-trigger {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  position: relative;
}

.copilot-trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
}

.copilot-trigger.has-suggestion {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
  }
  50% {
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.7), 0 0 0 10px rgba(102, 126, 234, 0.1);
  }
}

.notification-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.copilot-panel {
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: 420px;
  max-height: calc(100vh - 140px);
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.copilot-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-badge {
  padding: 4px 8px;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(34, 197, 94, 0.3);
  margin-left: auto;
  margin-right: 8px;
}

.close-btn {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.copilot-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.context-card {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 20px;
}

.context-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #60a5fa;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.context-text {
  color: #cbd5e1;
  font-size: 14px;
  line-height: 1.5;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  position: relative;
  transition: all 0.2s;
}

.suggestion-card:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(148, 163, 184, 0.2);
}

.suggestion-card.priority-high {
  border-left: 3px solid #ef4444;
}

.suggestion-card.priority-medium {
  border-left: 3px solid #f59e0b;
}

.suggestion-card.priority-low {
  border-left: 3px solid #3b82f6;
}

.suggestion-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.priority-high .suggestion-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.priority-medium .suggestion-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.priority-low .suggestion-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  color: white;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.suggestion-description {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.suggestion-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.action-btn.secondary {
  background: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.action-btn.secondary:hover {
  background: rgba(148, 163, 184, 0.2);
}

.dismiss-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.1);
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
}

.suggestion-card:hover .dismiss-btn {
  opacity: 1;
}

.dismiss-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.quick-actions-section {
  margin-top: 24px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: #667eea;
  color: white;
}

.insights-section {
  margin-top: 24px;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.insight-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.insight-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
}

.insight-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.insight-trend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}

.insight-trend.up {
  color: #22c55e;
}

.insight-trend.down {
  color: #ef4444;
}

/* Responsive */
@media (max-width: 768px) {
  .copilot-panel {
    right: 12px;
    left: 12px;
    width: auto;
    max-width: none;
  }

  .quick-actions-grid,
  .insights-grid {
    grid-template-columns: 1fr;
  }
}
</style>
