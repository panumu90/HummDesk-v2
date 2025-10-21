<template>
  <div class="breach-badge">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span>SLA Risk</span>
  </div>
</template>

<style scoped>
.breach-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--error);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--error);
  white-space: nowrap;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.breach-badge svg {
  animation: rotate 3s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
