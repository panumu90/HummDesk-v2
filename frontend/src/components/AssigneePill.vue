<template>
  <div class="assignee-pill">
    <div class="assignee-avatar" v-if="initials">
      {{ initials }}
    </div>
    <span class="assignee-name">{{ assignee.name }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  assignee: {
    id: string
    name: string
    avatar_url?: string
  }
}

const props = defineProps<Props>()

const initials = computed(() => {
  return props.assignee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
</script>

<style scoped>
.assignee-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.assignee-avatar {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: var(--radius-full);
  font-size: 9px;
  font-weight: var(--weight-bold);
  color: white;
}

.assignee-name {
  line-height: 1;
  font-weight: var(--weight-medium);
}
</style>
