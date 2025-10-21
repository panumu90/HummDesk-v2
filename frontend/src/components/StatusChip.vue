<template>
  <span class="status-chip" :class="`status-${status}`">
    <span class="status-dot"></span>
    <span class="status-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  status: 'open' | 'pending' | 'resolved'
}

const props = defineProps<Props>()

const label = computed(() => {
  return props.status.charAt(0).toUpperCase() + props.status.slice(1)
})
</script>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  transition: all 120ms var(--ease-in-out);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  animation: popIn 140ms var(--ease-spring);
}

.status-label {
  line-height: 1;
}

/* Status Variants */
.status-open {
  background: rgba(34, 197, 94, 0.15);
  color: var(--status-open);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.status-open .status-dot {
  background: var(--status-open);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.status-pending {
  background: rgba(245, 158, 11, 0.15);
  color: var(--status-pending);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.status-pending .status-dot {
  background: var(--status-pending);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-resolved {
  background: rgba(96, 165, 250, 0.15);
  color: var(--status-resolved);
  border: 1px solid rgba(96, 165, 250, 0.25);
}

.status-resolved .status-dot {
  background: var(--status-resolved);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
