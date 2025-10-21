<template>
  <div class="copilot">
    <header class="copilot__header">
      <div>
        <p class="copilot__eyebrow">Platform copilot</p>
        <h3 class="copilot__title">{{ tenantName }}</h3>
      </div>
      <div class="copilot__status">
        <span class="copilot__status-dot" />
        <span class="copilot__status-label">{{ statusLabel }}</span>
      </div>
    </header>

    <div class="copilot__pulse">
      <div class="pulse-card">
        <span class="pulse-label">Model confidence</span>
        <div class="confidence" role="img" :aria-label="`AI confidence ${aiConfidence}%`">
          <div class="confidence__ring">
            <svg viewBox="0 0 36 36" class="confidence__svg">
              <path
                class="confidence__track"
                d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
              />
              <path
                class="confidence__progress"
                :stroke-dasharray="`${normalizedConfidence}, 100`"
                d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
              />
            </svg>
            <span class="confidence__value">{{ aiConfidence }}%</span>
          </div>
        </div>
      </div>
      <div class="pulse-card">
        <span class="pulse-label">{{ nextMilestone.label }}</span>
        <span class="pulse-value">{{ nextMilestone.value }}</span>
        <span class="pulse-meta">{{ nextMilestone.meta }}</span>
      </div>
      <div class="pulse-card">
        <span class="pulse-label">Action queue</span>
        <span class="pulse-value">{{ suggestions.length }}</span>
        <span class="pulse-meta">Awaiting human-in-the-loop</span>
      </div>
    </div>

    <section class="copilot__section">
      <header class="section-header">
        <div>
          <h4 class="section-title">Orchestration feed</h4>
          <p class="section-subtitle">AI orchestrates playbooks before risk impacts tenants</p>
        </div>
      </header>
      <div class="suggestion-list">
        <article
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          class="suggestion-card"
          :class="toneClass(suggestion.tone)"
        >
          <div class="suggestion-meta">
            <span v-if="suggestion.badge" class="suggestion-badge">{{ suggestion.badge }}</span>
            <span v-if="suggestion.impact" class="suggestion-impact">{{ suggestion.impact }}</span>
          </div>
          <h5 class="suggestion-title">{{ suggestion.title }}</h5>
          <p class="suggestion-description">{{ suggestion.description }}</p>
          <div class="suggestion-actions">
            <button
              v-for="action in suggestion.actions"
              :key="action.label"
              :class="['suggestion-action', action.primary ? 'primary' : 'secondary']"
              type="button"
              @click="handleAction(action.value)"
            >
              {{ action.label }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="copilot__section">
      <header class="section-header">
        <div>
          <h4 class="section-title">Telemetry snapshot</h4>
          <p class="section-subtitle">Cross-tenant signals before escalation triggers</p>
        </div>
      </header>
      <div class="streams">
        <div
          v-for="item in streams"
          :key="item.id"
          class="stream-item"
          :class="`stream-item--${item.status}`"
        >
          <div>
            <p class="stream-label">{{ item.label }}</p>
            <p v-if="item.meta" class="stream-meta">{{ item.meta }}</p>
          </div>
          <span class="stream-value">{{ item.value }}</span>
        </div>
      </div>
    </section>

    <section class="copilot__section">
      <header class="section-header">
        <div>
          <h4 class="section-title">Launch a prompt</h4>
          <p class="section-subtitle">Copilot speaks product, revenue, ops, and compliance</p>
        </div>
      </header>
      <div class="prompt-grid">
        <button
          v-for="prompt in prompts"
          :key="prompt"
          type="button"
          class="prompt-chip"
          @click="handlePrompt(prompt)"
        >
          {{ prompt }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type CopilotTone = 'positive' | 'warning' | 'info'
type CopilotAction = {
  label: string
  value: string
  primary?: boolean
}

type CopilotSuggestion = {
  id: string
  title: string
  description: string
  impact?: string
  badge?: string
  tone?: CopilotTone
  actions: CopilotAction[]
}

type StreamStatus = 'forecast' | 'stabilized' | 'atRisk'

type StreamItem = {
  id: string
  label: string
  value: string
  meta?: string
  status: StreamStatus
}

const props = defineProps<{
  tenantName: string
  statusLabel: string
  aiConfidence: number
  nextMilestone: {
    label: string
    value: string
    meta: string
  }
  suggestions: CopilotSuggestion[]
  streams: StreamItem[]
  prompts: string[]
}>()

const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'prompt', prompt: string): void
}>()

const normalizedConfidence = computed(() => Math.min(100, Math.max(0, props.aiConfidence)))

function toneClass(tone?: CopilotTone) {
  switch (tone) {
    case 'positive':
      return 'suggestion-card--positive'
    case 'warning':
      return 'suggestion-card--warning'
    case 'info':
    default:
      return 'suggestion-card--info'
  }
}

function handleAction(action: string) {
  emit('action', action)
}

function handlePrompt(prompt: string) {
  emit('prompt', prompt)
}
</script>

<style scoped>
.copilot {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  border-radius: var(--radius-2xl);
  background: linear-gradient(180deg, rgba(17, 24, 40, 0.95) 0%, rgba(11, 18, 32, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 24px 60px rgba(8, 15, 30, 0.35);
  backdrop-filter: blur(22px);
  min-height: 100%;
}

.copilot__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.copilot__eyebrow {
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: var(--space-1);
}

.copilot__title {
  font-size: 1.35rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
  line-height: 1.25;
}

.copilot__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-full);
  background: rgba(45, 212, 191, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.3);
  color: #5eead4;
  font-size: 0.75rem;
  font-weight: var(--weight-medium);
}

.copilot__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
}

.copilot__pulse {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-4);
}

.pulse-card {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pulse-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-subtle);
}

.pulse-value {
  font-size: 1.25rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.pulse-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.confidence {
  display: flex;
  align-items: center;
  justify-content: center;
}

.confidence__ring {
  position: relative;
  width: 64px;
  height: 64px;
}

.confidence__svg {
  transform: rotate(-90deg);
  width: 64px;
  height: 64px;
}

.confidence__track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.12);
  stroke-width: 3;
}

.confidence__progress {
  fill: none;
  stroke-width: 3;
  stroke: #22d3ee;
  stroke-linecap: round;
}

.confidence__value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.copilot__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.section-title {
  font-size: 1rem;
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-1);
}

.section-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.suggestion-card {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(15, 23, 42, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.suggestion-card--positive {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(12, 54, 32, 0.65);
}

.suggestion-card--warning {
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(67, 32, 4, 0.65);
}

.suggestion-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.suggestion-badge {
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgba(96, 165, 250, 0.16);
  border: 1px solid rgba(96, 165, 250, 0.4);
  color: #bfdbfe;
  font-weight: var(--weight-medium);
}

.suggestion-impact {
  font-size: 0.7rem;
  color: rgba(34, 197, 94, 0.85);
  background: rgba(34, 197, 94, 0.08);
  border-radius: var(--radius-full);
  padding: 0.2rem 0.6rem;
}

.suggestion-title {
  font-size: 1rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.suggestion-description {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: var(--leading-relaxed);
}

.suggestion-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.suggestion-action {
  padding: 0.55rem 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
}

.suggestion-action.primary {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.4), rgba(56, 189, 248, 0.6));
  border-color: rgba(14, 165, 233, 0.4);
  color: #e0f2fe;
}

.suggestion-action.secondary {
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
}

.suggestion-action:hover {
  transform: translateY(-2px);
  border-color: rgba(34, 211, 238, 0.45);
}

.streams {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stream-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(9, 14, 26, 0.8);
}

.stream-item--forecast {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(120, 53, 15, 0.25);
}

.stream-item--stabilized {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(22, 101, 52, 0.25);
}

.stream-item--atRisk {
  border-color: rgba(14, 165, 233, 0.3);
  background: rgba(12, 74, 110, 0.25);
}

.stream-label {
  font-size: 0.85rem;
  font-weight: var(--weight-medium);
}

.stream-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stream-value {
  font-size: 0.95rem;
  font-weight: var(--weight-semibold);
}

.prompt-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.prompt-chip {
  padding: 0.55rem 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(34, 211, 238, 0.35);
  background: rgba(13, 148, 136, 0.12);
  color: #5eead4;
  font-size: 0.85rem;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
}

.prompt-chip:hover {
  transform: translateY(-2px);
  border-color: rgba(34, 211, 238, 0.6);
  background: rgba(15, 118, 110, 0.22);
}

@media (max-width: 1024px) {
  .copilot {
    padding: var(--space-5);
    border-radius: var(--radius-xl);
  }

  .copilot__pulse {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}
</style>

