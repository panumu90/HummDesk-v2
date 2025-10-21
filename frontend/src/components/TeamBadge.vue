<template>
  <div class="team-badge" :style="{ borderColor: team.color, color: team.color }">
    {{ team.name }}
  </div>
</template>

<script setup lang="ts">
interface Props {
  team: {
    id: string
    name: string
    color: string
  }
}

defineProps<Props>()
</script>

<style scoped>
.team-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border: 1px solid;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  line-height: 1;
}
</style>
