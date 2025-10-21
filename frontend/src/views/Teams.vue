<template>
  <AppShell>
    <div class="teams-view">
      <!-- Header -->
      <div class="teams-header">
        <div>
          <h1 class="page-title">Teams</h1>
          <p class="page-subtitle">Manage teams and track performance</p>
        </div>
        <button class="btn-primary" @click="showCreateModal = true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Create Team
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="teams-grid">
        <div class="team-card shimmer" v-for="n in 3" :key="n"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="teams.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path d="M44 52v-4a8 8 0 0 0-8-8H20a8 8 0 0 0-8 8v4M28 32a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM48 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM52 52v-3a6 6 0 0 0-4.5-5.8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="empty-title">No Teams Yet</h3>
        <p class="empty-description">Create your first team to get started</p>
        <button class="btn-primary" @click="showCreateModal = true">
          Create Team
        </button>
      </div>

      <!-- Teams Grid -->
      <div v-else class="teams-grid">
        <div
          v-for="team in teams"
          :key="team.id"
          class="team-card"
          :class="{ expanded: expandedTeamId === team.id }"
        >
          <!-- Team Header -->
          <div class="team-header">
            <div class="team-info">
              <div class="team-icon" :style="{ background: getTeamColor(team.name) }">
                {{ getTeamEmoji(team.name) }}
              </div>
              <div>
                <h3 class="team-name">{{ team.name }}</h3>
                <p class="team-description" v-if="team.description">{{ team.description }}</p>
              </div>
            </div>
            <button
              class="expand-btn"
              @click="toggleExpand(team.id)"
              :title="expandedTeamId === team.id ? 'Collapse' : 'Expand'"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" :class="{ rotated: expandedTeamId === team.id }">
                <path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- Team Stats -->
          <div class="team-stats">
            <div class="stat-item">
              <div class="stat-label">Online Agents</div>
              <div class="stat-value">{{ team.online_agents }}/{{ team.total_agents }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Utilization</div>
              <div class="stat-value">
                <span :class="getUtilizationClass(team.utilization)">{{ team.utilization }}%</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Avg CSAT</div>
              <div class="stat-value">{{ formatCsat(team.avg_csat) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">SLA Compliance</div>
              <div class="stat-value">{{ formatSla(team.sla_compliance) }}</div>
            </div>
          </div>

          <!-- Utilization Bar -->
          <div class="utilization-bar">
            <div
              class="utilization-fill"
              :class="getUtilizationClass(team.utilization)"
              :style="{ width: `${team.utilization}%` }"
            ></div>
          </div>

          <!-- Expanded: Agent List -->
          <transition name="expand">
            <div v-if="expandedTeamId === team.id" class="agents-section">
              <div class="agents-header">
                <h4 class="agents-title">Team Members ({{ agents.length }})</h4>
                <button class="btn-secondary btn-sm" @click="handleAddAgent(team.id)">
                  Add Agent
                </button>
              </div>

              <div v-if="loadingAgents" class="agents-loading">
                <div class="shimmer-agent" v-for="n in 3" :key="n"></div>
              </div>

              <div v-else-if="agents.length === 0" class="agents-empty">
                No agents in this team yet
              </div>

              <div v-else class="agents-list">
                <div
                  v-for="agent in agents"
                  :key="agent.id"
                  class="agent-item"
                >
                  <!-- Agent Avatar & Info -->
                  <div class="agent-info">
                    <div class="agent-avatar">
                      {{ getInitials(agent.user.name) }}
                      <div class="agent-status" :class="`status-${agent.availability}`"></div>
                    </div>
                    <div class="agent-details">
                      <div class="agent-name">{{ agent.user.name }}</div>
                      <div class="agent-email">{{ agent.user.email }}</div>
                    </div>
                  </div>

                  <!-- Agent Metrics -->
                  <div class="agent-metrics">
                    <div class="metric">
                      <div class="metric-label">Load</div>
                      <div class="metric-value">{{ agent.current_load }}/{{ agent.max_capacity }}</div>
                    </div>
                    <div class="metric">
                      <div class="metric-label">Availability</div>
                      <div class="availability-badge" :class="`badge-${agent.availability}`">
                        {{ formatAvailability(agent.availability) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import AppShell from '@/layouts/AppShell.vue'

interface Team {
  id: number
  name: string
  description?: string
  online_agents: number
  total_agents: number
  utilization: number
  avg_csat: number
  sla_compliance: number
}

interface Agent {
  id: number
  user: {
    id: number
    name: string
    email: string
    avatar_url?: string
  }
  availability: 'online' | 'offline' | 'busy' | 'away'
  current_load: number
  max_capacity: number
  performance: {
    avg_response_time: number
    csat_score: number
    resolution_rate: number
  }
}

const teams = ref<Team[]>([])
const agents = ref<Agent[]>([])
const loading = ref(true)
const loadingAgents = ref(false)
const expandedTeamId = ref<number | null>(null)
const showCreateModal = ref(false)

async function loadTeams() {
  try {
    loading.value = true
    const response = await axios.get('/api/v1/teams')
    teams.value = response.data.data
  } catch (error) {
    console.error('Failed to load teams:', error)
  } finally {
    loading.value = false
  }
}

async function loadAgents(teamId: number) {
  try {
    loadingAgents.value = true
    const response = await axios.get(`/api/v1/teams/${teamId}/agents`)
    agents.value = response.data.data
  } catch (error) {
    console.error('Failed to load agents:', error)
  } finally {
    loadingAgents.value = false
  }
}

async function toggleExpand(teamId: number) {
  if (expandedTeamId.value === teamId) {
    expandedTeamId.value = null
    agents.value = []
  } else {
    expandedTeamId.value = teamId
    await loadAgents(teamId)
  }
}

function getTeamColor(name: string): string {
  const colors: Record<string, string> = {
    'Billing': 'linear-gradient(135deg, #22C55E, #16A34A)',
    'Technical Support': 'linear-gradient(135deg, #3B82F6, #2563EB)',
    'Sales': 'linear-gradient(135deg, #F59E0B, #D97706)',
  }
  return colors[name] || 'linear-gradient(135deg, var(--primary), var(--accent))'
}

function getTeamEmoji(name: string): string {
  const emojis: Record<string, string> = {
    'Billing': '💰',
    'Technical Support': '🔧',
    'Sales': '🎯',
  }
  return emojis[name] || '👥'
}

function getUtilizationClass(utilization: number): string {
  if (utilization >= 90) return 'critical'
  if (utilization >= 70) return 'warning'
  return 'ok'
}

function formatCsat(score: number): string {
  return score > 0 ? `${score.toFixed(1)}/5.0` : 'N/A'
}

function formatSla(compliance: number): string {
  return compliance > 0 ? `${compliance.toFixed(0)}%` : 'N/A'
}

function formatAvailability(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function handleAddAgent(teamId: number) {
  // TODO: Implement add agent modal
  console.log('Add agent to team:', teamId)
}

onMounted(() => {
  loadTeams()
})
</script>

<style scoped>
.teams-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.teams-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--divider);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-1) 0;
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--bg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-primary:hover {
  background: var(--primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-secondary:hover {
  background: var(--surface-2);
  border-color: var(--accent);
}

.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

/* Teams Grid */
.teams-grid {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--space-6);
  align-content: start;
}

.team-card {
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  transition: all var(--duration-normal) var(--ease-out);
}

.team-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.team-card.expanded {
  grid-column: 1 / -1;
  border-color: var(--accent);
}

/* Team Header */
.team-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.team-info {
  display: flex;
  gap: var(--space-4);
  flex: 1;
}

.team-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xl);
  font-size: 28px;
  box-shadow: var(--shadow-sm);
}

.team-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-1) 0;
}

.team-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.expand-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.expand-btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.expand-btn svg {
  transition: transform var(--duration-normal) var(--ease-out);
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

/* Team Stats */
.team-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-subtle);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.stat-value .ok {
  color: var(--status-open);
}

.stat-value .warning {
  color: var(--status-pending);
}

.stat-value .critical {
  color: var(--status-error);
}

/* Utilization Bar */
.utilization-bar {
  height: 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-4);
}

.utilization-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-out);
}

.utilization-fill.ok {
  background: var(--status-open);
}

.utilization-fill.warning {
  background: var(--status-pending);
}

.utilization-fill.critical {
  background: var(--status-error);
}

/* Agents Section */
.agents-section {
  border-top: 1px solid var(--divider);
  padding-top: var(--space-4);
}

.agents-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.agents-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.agents-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-out);
}

.agent-item:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}

.agent-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.agent-avatar {
  position: relative;
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

.agent-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  border: 2px solid var(--surface-2);
}

.status-online {
  background: var(--status-open);
}

.status-offline {
  background: var(--text-subtle);
}

.status-busy {
  background: var(--status-error);
}

.status-away {
  background: var(--status-pending);
}

.agent-details {
  flex: 1;
}

.agent-name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text);
  margin-bottom: var(--space-1);
}

.agent-email {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.agent-metrics {
  display: flex;
  gap: var(--space-6);
}

.metric {
  text-align: right;
}

.metric-label {
  font-size: var(--text-xs);
  color: var(--text-subtle);
  margin-bottom: var(--space-1);
}

.metric-value {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.availability-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.badge-online {
  background: rgba(34, 197, 94, 0.15);
  color: var(--status-open);
}

.badge-offline {
  background: rgba(100, 116, 139, 0.15);
  color: var(--text-subtle);
}

.badge-busy {
  background: rgba(239, 68, 68, 0.15);
  color: var(--status-error);
}

.badge-away {
  background: rgba(245, 158, 11, 0.15);
  color: var(--status-pending);
}

/* Empty States */
.empty-state,
.agents-empty,
.agents-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-2xl);
  color: var(--text-subtle);
  margin-bottom: var(--space-6);
}

.empty-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-muted);
  margin: 0 0 var(--space-6) 0;
}

.agents-empty {
  padding: var(--space-6);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Shimmer Loading */
.shimmer {
  background: linear-gradient(
    90deg,
    var(--surface) 0%,
    var(--surface-hover) 50%,
    var(--surface) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  min-height: 280px;
  border-radius: var(--radius-xl);
}

.shimmer-agent {
  height: 80px;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

/* Expand Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-slow) var(--ease-out);
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .teams-grid {
    grid-template-columns: 1fr;
  }

  .team-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .agent-metrics {
    flex-direction: column;
    gap: var(--space-2);
  }
}
</style>
