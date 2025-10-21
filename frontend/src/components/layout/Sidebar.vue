<template>
  <nav class="sidebar">
    <!-- Logo / Brand -->
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-logo">HD</div>
        <div class="brand-text">
          <h1 class="brand-title">HummDesk</h1>
          <span class="brand-subtitle">v2.0</span>
        </div>
      </div>
    </div>

    <!-- Navigation Items -->
    <div class="nav-section">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <component :is="item.icon" class="nav-icon" />
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
      </router-link>
    </div>

    <!-- Settings / Footer -->
    <div class="sidebar-footer">
      <router-link to="/settings" class="nav-item">
        <svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.168 12.5a1.5 1.5 0 0 0 .3 1.65l.055.055a1.818 1.818 0 1 1-2.572 2.572l-.055-.055a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.909 1.373v.155a1.818 1.818 0 0 1-3.636 0v-.082a1.5 1.5 0 0 0-.982-1.373 1.5 1.5 0 0 0-1.65.3l-.055.055a1.818 1.818 0 1 1-2.572-2.572l.055-.055a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.373-.909h-.155a1.818 1.818 0 0 1 0-3.636h.082a1.5 1.5 0 0 0 1.373-.982 1.5 1.5 0 0 0-.3-1.65l-.055-.055A1.818 1.818 0 1 1 4.945 2.773l.055.055a1.5 1.5 0 0 0 1.65.3h.073a1.5 1.5 0 0 0 .909-1.373v-.155a1.818 1.818 0 0 1 3.636 0v.082a1.5 1.5 0 0 0 .909 1.373 1.5 1.5 0 0 0 1.65-.3l.055-.055a1.818 1.818 0 1 1 2.572 2.572l-.055.055a1.5 1.5 0 0 0-.3 1.65v.073a1.5 1.5 0 0 0 1.373.909h.155a1.818 1.818 0 0 1 0 3.636h-.082a1.5 1.5 0 0 0-1.373.909z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="nav-label">Settings</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

// Navigation icons as inline SVG components
const InboxIcon = {
  template: `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M16.667 10.833H13.333L11.667 13.333H8.333L6.667 10.833H3.333M16.667 10.833V15.833C16.667 16.275 16.491 16.699 16.179 17.011C15.866 17.323 15.442 17.5 15 17.5H5C4.558 17.5 4.134 17.323 3.821 17.011C3.509 16.699 3.333 16.275 3.333 15.833V10.833M16.667 10.833L15 2.5H5L3.333 10.833" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

const TeamIcon = {
  template: `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M14.167 17.5v-1.667A3.333 3.333 0 0 0 10.833 12.5h-5A3.333 3.333 0 0 0 2.5 15.833V17.5M18.333 17.5v-1.667a3.333 3.333 0 0 0-2.5-3.225M13.333 2.608a3.333 3.333 0 0 1 0 6.45M11.25 6.25a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

const AnalyticsIcon = {
  template: `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M17.5 17.5H2.5V2.5M5.833 12.5l3.334-3.333L12.5 12.5l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

const KnowledgeIcon = {
  template: `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 4h12a1 1 0 0 1 1 1v14l-7-3-7 3V5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

const navItems = [
  { path: '/conversations', label: 'Conversations', icon: InboxIcon, badge: '12' },
  { path: '/teams', label: 'Teams', icon: TeamIcon },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: KnowledgeIcon },
  { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
]

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-header {
  padding: var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--divider);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.brand-logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: white;
}

.brand-text {
  flex: 1;
}

.brand-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Navigation Section */
.nav-section {
  flex: 1;
  padding: var(--space-4) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--text-muted);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  transition: all var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text);
  transform: translateX(2px);
}

.nav-item.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset,
              0 0 20px rgba(30, 58, 138, 0.4);
}

.nav-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--bg);
  animation: popIn var(--duration-normal) var(--ease-spring);
}

.nav-item.active .nav-badge {
  background: white;
  color: var(--primary);
}

/* Footer */
.sidebar-footer {
  padding: var(--space-4) var(--space-2);
  border-top: 1px solid var(--divider);
}
</style>
