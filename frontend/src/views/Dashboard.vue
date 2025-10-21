<template>
  <AppShell>
    <div class="dashboard">
      <header class="dashboard__header">
        <div>
          <p class="dashboard__eyebrow">Multi-tenant command center</p>
          <h1 class="dashboard__title">HummDesk - AI-native 2025</h1>
          <p class="dashboard__subtitle">
            Copilot stabilizes {{ tenants.length }} enterprise tenants in real time.
          </p>
        </div>
        <div class="dashboard__operator">
          <span class="operator-label">Duty lead</span>
          <div class="operator-card">
            <div class="operator-avatar">{{ operatorInitials }}</div>
            <div>
              <p class="operator-name">{{ operatorName }}</p>
              <p class="operator-meta">{{ operatorEmail }}</p>
            </div>
          </div>
        </div>
      </header>

      <div class="dashboard__grid">
        <section class="dashboard__main">
          <section class="tenant-rail">
            <button
              v-for="tenant in tenants"
              :key="tenant.id"
              type="button"
              class="tenant-card"
              :class="{ active: tenant.id === selectedTenantId }"
              @click="selectTenant(tenant.id)"
            >
              <div class="tenant-card__meta">
                <span class="tenant-card__avatar">{{ tenant.avatar }}</span>
                <div>
                  <p class="tenant-card__name">{{ tenant.name }}</p>
                  <p class="tenant-card__plan">{{ tenant.plan }}</p>
                </div>
              </div>
              <div class="tenant-card__stats">
                <span class="tenant-card__load">{{ tenant.load }}</span>
                <span
                  :class="[
                    'tenant-card__trend',
                    tenant.delta.startsWith('+') ? 'trend-up' : 'trend-down',
                  ]"
                >
                  {{ tenant.delta }}
                </span>
              </div>
            </button>
          </section>

          <section class="metric-grid">
            <article v-for="metric in metricCards" :key="metric.id" class="metric-card">
              <div class="metric-card__icon" :style="{ background: metric.accent }">
                <component :is="metric.icon" class="metric-card__icon-svg" />
              </div>
              <div class="metric-card__content">
                <p class="metric-card__label">{{ metric.label }}</p>
                <div class="metric-card__value-row">
                  <span class="metric-card__value">{{ metric.value }}</span>
                  <span :class="['metric-card__delta', metric.trend === 'up' ? 'up' : 'down']">
                    {{ metric.delta }}
                  </span>
                </div>
                <p class="metric-card__hint">{{ metric.hint }}</p>
              </div>
            </article>
          </section>

          <section class="dashboard-panels">
            <article class="panel panel--primary">
              <header class="panel__header">
                <div>
                  <p class="panel__eyebrow">Tenant focus</p>
                  <h2 class="panel__title">{{ selectedTenant.name }}</h2>
                </div>
                <span :class="['panel__status', selectedTenant.status]">
                  {{ selectedTenant.statusLabel }}
                </span>
              </header>
              <div class="panel__grid">
                <div v-for="stat in selectedTenant.focus" :key="stat.id" class="panel-metric">
                  <p class="panel-metric__label">{{ stat.label }}</p>
                  <p class="panel-metric__value">{{ stat.value }}</p>
                  <p class="panel-metric__meta">{{ stat.meta }}</p>
                </div>
              </div>
            </article>

            <article class="panel panel--secondary">
              <header class="panel__header">
                <div>
                  <p class="panel__eyebrow">Network monitors</p>
                  <h2 class="panel__title">Cross-tenant guardrails</h2>
                </div>
                <button class="panel__action" type="button" @click="router.push('/analytics')">
                  View analytics
                </button>
              </header>
              <div class="monitor-list">
                <div v-for="monitor in selectedTenant.monitors" :key="monitor.id" class="monitor">
                  <div class="monitor__header">
                    <span :class="['monitor__badge', monitor.state]">{{ monitor.label }}</span>
                    <span class="monitor__value">{{ monitor.value }}</span>
                  </div>
                  <p class="monitor__description">{{ monitor.description }}</p>
                </div>
              </div>
            </article>
          </section>

          <section class="timeline">
            <header class="panel__header">
              <div>
                <p class="panel__eyebrow">Live stream</p>
                <h2 class="panel__title">Latest ops moments</h2>
              </div>
              <button class="panel__action" type="button" @click="router.push('/conversations')">
                Open queue
              </button>
            </header>
            <div class="timeline__list">
              <div v-for="event in timelineEvents" :key="event.id" class="timeline__item">
                <span class="timeline__time">{{ event.time }}</span>
                <div class="timeline__body">
                  <div class="timeline__heading">
                    <h3 class="timeline__title">{{ event.title }}</h3>
                    <span :class="['timeline__impact', event.impact]">
                      {{ event.impact === 'up' ? 'Improving' : 'Watch' }}
                    </span>
                  </div>
                  <p class="timeline__summary">{{ event.summary }}</p>
                  <div class="timeline__tags">
                    <span v-for="tag in event.tags" :key="tag" class="timeline__tag">{{ tag }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside class="dashboard__sidecar">
          <PlatformCopilot
            :tenant-name="selectedTenant.name"
            :status-label="copilotStatus"
            :ai-confidence="copilotConfidence"
            :next-milestone="nextMilestone"
            :suggestions="copilotSuggestions"
            :streams="telemetryStreams"
            :prompts="copilotPrompts"
            @action="handleCopilotAction"
            @prompt="handleCopilotPrompt"
          />
          <section class="sidecard">
            <header class="sidecard__header">
              <h3 class="sidecard__title">Signal overrides</h3>
              <span class="sidecard__badge">Realtime</span>
            </header>
            <div class="sidecard__body">
              <div v-for="signal in signalOverrides" :key="signal.id" class="signal">
                <div>
                  <p class="signal__label">{{ signal.label }}</p>
                  <p class="signal__meta">{{ signal.meta }}</p>
                </div>
                <span :class="['signal__state', signal.state]">{{ signal.stateLabel }}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </AppShell>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import PlatformCopilot from '@/components/copilot/PlatformCopilot.vue'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'

const router = useRouter()
const authStore = useAuthStore()
const conversationsStore = useConversationsStore()

type TenantFocus = {
  id: string
  label: string
  value: string
  meta: string
}

type TenantMonitorState = 'positive' | 'warning' | 'critical'

type TenantMonitor = {
  id: string
  label: string
  description: string
  value: string
  state: TenantMonitorState
}

type TimelineImpact = 'up' | 'down'

type TimelineEvent = {
  id: string
  time: string
  title: string
  summary: string
  tags: string[]
  impact: TimelineImpact
}

type TenantProfile = {
  id: string
  name: string
  avatar: string
  plan: string
  load: string
  delta: string
  status: 'stable' | 'watch' | 'alert'
  statusLabel: string
  aiConfidence: number
  activeChannels: string
  autopilotShare: string
  deflectionRate: string
  focus: TenantFocus[]
  monitors: TenantMonitor[]
  timeline: TimelineEvent[]
  milestone: {
    label: string
    value: string
    meta: string
  }
  telemetry: Array<{
    id: string
    label: string
    value: string
    meta: string
    status: 'forecast' | 'stabilized' | 'atRisk'
  }>
}

const tenants: TenantProfile[] = [
  {
    id: 'aurora',
    name: 'Aurora Mobility',
    avatar: 'AM',
    plan: 'Enterprise - Mobility',
    load: '73% load',
    delta: '+6.4%',
    status: 'stable',
    statusLabel: 'Stable - 7.4 CSAT',
    aiConfidence: 88,
    activeChannels: '6 channels live',
    autopilotShare: '62% auto-resolved',
    deflectionRate: '38% deflection',
    focus: [
      { id: 'queue', label: 'Queue intensity', value: '73%', meta: 'AI swarms reroute in 22s' },
      { id: 'sla', label: 'SLA horizon', value: '4.2h buffer', meta: 'Next risk cluster: LATAM' },
      { id: 'csat', label: 'CSAT', value: '91.4', meta: '+4.2 week over week with proactive nudges' },
      { id: 'revenue', label: 'Expansion pipeline', value: '$420k', meta: 'Playbook: Mobility premium' },
    ],
    monitors: [
      {
        id: 'auth',
        label: 'Auth fatigue',
        description: 'Login friction spiking after new MFA rollout on EU pods.',
        value: 'Guard - 2.1%',
        state: 'warning',
      },
      {
        id: 'billing',
        label: 'Billing leakage',
        description: 'Duplicate invoices eliminated via LLM detection.',
        value: '-18%',
        state: 'positive',
      },
      {
        id: 'trust',
        label: 'Trust and safety',
        description: 'Moderation backlog under 12 min, no escalations pending.',
        value: 'Green',
        state: 'positive',
      },
    ],
    timeline: [
      {
        id: 't-aurora-1',
        time: 'Now',
        title: 'Copilot rerouted EU subscription surge',
        summary: '90 conversations re-balanced to Ops North pod, SLA buffer plus 38 min.',
        tags: ['EU', 'Autoswarm', 'Subscription'],
        impact: 'up',
      },
      {
        id: 't-aurora-2',
        time: '09:32',
        title: 'Knowledge card published',
        summary: 'GenAI synthesized battery recall macro, ops approved in 11 min.',
        tags: ['Knowledge', 'Recall'],
        impact: 'up',
      },
    ],
    milestone: {
      label: 'Next milestone',
      value: 'Premium rollout - T-2h',
      meta: 'Feature flag sync across EU and APAC clusters',
    },
    telemetry: [
      {
        id: 'telemetry-sla',
        label: 'SLA pressure - next 4h',
        value: '-18%',
        meta: 'Normalized vs rolling 28 day baseline',
        status: 'forecast',
      },
      {
        id: 'telemetry-csat',
        label: 'CSAT stabilization',
        value: '+4.2',
        meta: 'Trailing 7 day uplift after macros',
        status: 'stabilized',
      },
      {
        id: 'telemetry-trust',
        label: 'Trust escalations',
        value: '7 flagged',
        meta: 'Hold Ops EU until audit clears',
        status: 'atRisk',
      },
    ],
  },
  {
    id: 'nebula',
    name: 'Nebula SaaS',
    avatar: 'NS',
    plan: 'Scale - AI SaaS',
    load: '61% load',
    delta: '+3.1%',
    status: 'watch',
    statusLabel: 'Watch - billing experiments',
    aiConfidence: 82,
    activeChannels: '5 channels live',
    autopilotShare: '54% auto-resolved',
    deflectionRate: '33% deflection',
    focus: [
      { id: 'queue', label: 'Queue intensity', value: '61%', meta: 'APAC backlog down 12%' },
      { id: 'sla', label: 'SLA horizon', value: '2.7h buffer', meta: 'Billing beta causing 3 spikes' },
      { id: 'csat', label: 'CSAT', value: '88.9', meta: 'Nudges in rollout hold' },
      { id: 'revenue', label: 'Expansion pipeline', value: '$190k', meta: 'Upsell: Teams AI pack' },
    ],
    monitors: [
      {
        id: 'billing-exp',
        label: 'Billing experiments',
        description: 'AI flagged invoices failing new pricing tier migration.',
        value: '12 incidents',
        state: 'warning',
      },
      {
        id: 'infra',
        label: 'Infra latencies',
        description: 'Spike resolved after auto-scaling compute in us-west.',
        value: '-34%',
        state: 'positive',
      },
      {
        id: 'security',
        label: 'Security posture',
        description: 'OAuth anomaly flow auto-closed with guardrail 42.',
        value: 'Green',
        state: 'positive',
      },
    ],
    timeline: [
      {
        id: 't-nebula-1',
        time: '10:12',
        title: 'Playbook deployed for renewal objections',
        summary: 'Converted 18 blockers via pricing sandbox updates.',
        tags: ['Renewal', 'Playbook'],
        impact: 'up',
      },
      {
        id: 't-nebula-2',
        time: '08:46',
        title: 'Trust and safety flagged API abuse',
        summary: 'Copilot paused 6 integrations until dev verification.',
        tags: ['Trust', 'API'],
        impact: 'down',
      },
    ],
    milestone: {
      label: 'Next milestone',
      value: 'Billing beta review - 16:00 UTC',
      meta: 'Finance and CS leadership sync',
    },
    telemetry: [
      {
        id: 'telemetry-sla',
        label: 'Renewal risk index',
        value: '+12%',
        meta: 'Account tier B seeing friction',
        status: 'atRisk',
      },
      {
        id: 'telemetry-automation',
        label: 'Automation share',
        value: '54%',
        meta: 'LLM autop completes 3 of 5 playbooks',
        status: 'stabilized',
      },
      {
        id: 'telemetry-product',
        label: 'Product incident horizon',
        value: 'Low',
        meta: 'No major changelog pushes today',
        status: 'forecast',
      },
    ],
  },
  {
    id: 'zenith',
    name: 'Zenith Commerce',
    avatar: 'ZC',
    plan: 'Enterprise - Retail',
    load: '81% load',
    delta: '+1.8%',
    status: 'alert',
    statusLabel: 'Alert - returns spike',
    aiConfidence: 76,
    activeChannels: '8 channels live',
    autopilotShare: '49% auto-resolved',
    deflectionRate: '29% deflection',
    focus: [
      { id: 'queue', label: 'Queue intensity', value: '81%', meta: 'Returns surge after launch' },
      { id: 'sla', label: 'SLA horizon', value: '1.1h buffer', meta: 'Ops staffing patching gap' },
      { id: 'csat', label: 'CSAT', value: '82.6', meta: 'Drop isolated to returns' },
      { id: 'revenue', label: 'Revenue coverage', value: '$1.1M', meta: 'VIP concierge program' },
    ],
    monitors: [
      {
        id: 'returns',
        label: 'Returns spike',
        description: 'Wearables returns 2.3x; automation deflecting 61% via macros.',
        value: 'Critical',
        state: 'critical',
      },
      {
        id: 'shipping',
        label: 'Shipping ETA drift',
        description: 'LLM negotiating vendor hold times across carriers.',
        value: '-22 min',
        state: 'positive',
      },
      {
        id: 'loyalty',
        label: 'Loyalty segment health',
        description: 'Net retention safe; watch top 5 VIP accounts.',
        value: 'Amber',
        state: 'warning',
      },
    ],
    timeline: [
      {
        id: 't-zenith-1',
        time: '09:58',
        title: 'Returns automation escalated to task force',
        summary: 'Ops assigned 3 specialists, AI co-writes outreach threads.',
        tags: ['Returns', 'Task Force'],
        impact: 'down',
      },
      {
        id: 't-zenith-2',
        time: '07:44',
        title: 'Inventory sync patched via webhook resync',
        summary: 'Copilot executed fix playbook 19 with rollback guard.',
        tags: ['Inventory', 'Automation'],
        impact: 'up',
      },
    ],
    milestone: {
      label: 'Next milestone',
      value: 'Returns summit - 45 min',
      meta: 'Merch, Ops, Finance aligning mitigation',
    },
    telemetry: [
      {
        id: 'telemetry-returns',
        label: 'Returns spike delta',
        value: '+132%',
        meta: 'LLM suggests vendor handshake',
        status: 'atRisk',
      },
      {
        id: 'telemetry-deflection',
        label: 'Self-serve deflection',
        value: '49%',
        meta: 'Aura AI flows deflecting returns macros',
        status: 'stabilized',
      },
      {
        id: 'telemetry-supply',
        label: 'Supply chain signals',
        value: 'Moderate',
        meta: 'Awaiting SAP integration patch',
        status: 'forecast',
      },
    ],
  },
]

const selectedTenantId = ref(tenants[0].id)
const selectedTenant = computed(() => tenants.find(t => t.id === selectedTenantId.value) ?? tenants[0])

const activeConversations = computed(() => conversationsStore.activeConversations.length || 0)
const pendingCount = computed(
  () => conversationsStore.conversations.filter(conversation => conversation.status === 'pending').length,
)
const closedToday = computed(() => conversationsStore.closedConversations.length || 0)

const numberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

const WaveIcon = {
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 12c2-2.5 4-3.5 6-3s4 3 6 3 4-1 6-3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 17c2-2.5 4-3.5 6-3s4 3 6 3 4-1 6-3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3"/>
    </svg>
  `,
}

const SparkIcon = {
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3v4M12 17v4M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83M3 12h4M17 12h4" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="3.5" stroke-width="1.6"/>
    </svg>
  `,
}

const ClockIcon = {
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="7" stroke-width="1.6"/>
      <path d="M12 9v4l2.5 1.5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
}

const ShieldIcon = {
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
}

const metricCards = computed(() => {
  const tenant = selectedTenant.value
  return [
    {
      id: 'active',
      label: 'Active conversations',
      value: formatNumber(activeConversations.value),
      delta: '+18%',
      trend: 'up' as const,
      hint: tenant.activeChannels,
      icon: WaveIcon,
      accent: 'linear-gradient(135deg, rgba(34, 211, 238, 0.35), rgba(59, 130, 246, 0.45))',
    },
    {
      id: 'pending',
      label: 'Pending assignment',
      value: formatNumber(pendingCount.value),
      delta: '-6%',
      trend: 'down' as const,
      hint: 'AI queues staged for autoswarm',
      icon: SparkIcon,
      accent: 'linear-gradient(135deg, rgba(251, 191, 36, 0.32), rgba(250, 204, 21, 0.4))',
    },
    {
      id: 'closed',
      label: 'Closed today',
      value: formatNumber(closedToday.value),
      delta: '+9%',
      trend: 'up' as const,
      hint: 'Across 24 hour rolling window',
      icon: ClockIcon,
      accent: 'linear-gradient(135deg, rgba(168, 85, 247, 0.32), rgba(129, 140, 248, 0.4))',
    },
    {
      id: 'automation',
      label: 'Automation share',
      value: tenant.autopilotShare,
      delta: '+4 pts',
      trend: 'up' as const,
      hint: tenant.deflectionRate,
      icon: ShieldIcon,
      accent: 'linear-gradient(135deg, rgba(45, 212, 191, 0.35), rgba(20, 184, 166, 0.4))',
    },
  ]
})

const globalTimeline: TimelineEvent[] = [
  {
    id: 'global-ops-1',
    time: '10:21',
    title: 'Ops alignment sync completed',
    summary: 'Finance and CS leads approved next-hour automation guardrails.',
    tags: ['Ops', 'Guardrail'],
    impact: 'up',
  },
  {
    id: 'global-ops-2',
    time: '09:05',
    title: 'Knowledge embeddings refreshed',
    summary: 'All tenants syncing latest macros and product changelog.',
    tags: ['Knowledge', 'Embedding'],
    impact: 'up',
  },
]

const timelineEvents = computed(() => {
  const tenantEvents = selectedTenant.value.timeline
  return [...tenantEvents, ...globalTimeline].slice(0, 5)
})

const copilotConfidence = computed(() => selectedTenant.value.aiConfidence)
const nextMilestone = computed(() => selectedTenant.value.milestone)
const telemetryStreams = computed(() => selectedTenant.value.telemetry)
const copilotStatus = computed(() => selectedTenant.value.statusLabel)

const baseCopilotSuggestions = [
  {
    id: 'reroute',
    title: 'Autoswarm {tenant} backlog',
    description: 'Volume spike predicted in the next 22 min. Recommend spinning Ops North pod and syncing macros.',
    impact: 'Protect $42k ARR',
    badge: 'Proactive',
    tone: 'warning' as const,
    actions: [
      { label: 'Open queue view', value: 'open_queue', primary: true },
      { label: 'Sync with Ops', value: 'sync_ops' },
    ],
  },
  {
    id: 'broadcast',
    title: 'Broadcast status to exec channel',
    description: '{tenant} milestone in T-2h. Draft update ready including SLA risk and mitigation steps.',
    impact: 'Exec visibility',
    badge: 'Comms',
    tone: 'info' as const,
    actions: [
      { label: 'Edit briefing', value: 'open_briefing', primary: true },
      { label: 'Dispatch to Slack', value: 'send_slack' },
    ],
  },
  {
    id: 'knowledge',
    title: 'Promote new macro to playbook',
    description: 'Copilot generated guidance for returns surge. Recommend publishing to frontline library for all tenants.',
    impact: 'Reduce handle time',
    badge: 'Knowledge',
    tone: 'positive' as const,
    actions: [
      { label: 'Review draft', value: 'review_macro', primary: true },
      { label: 'Schedule training', value: 'open_training' },
    ],
  },
]

const copilotSuggestions = computed(() =>
  baseCopilotSuggestions.map(suggestion => ({
    ...suggestion,
    title: suggestion.title.replace('{tenant}', selectedTenant.value.name),
    description: suggestion.description.replace('{tenant}', selectedTenant.value.name),
    actions: suggestion.actions.map(action => ({ ...action })),
  })),
)

const basePrompts = [
  'Draft status update for {tenant} leadership channel',
  'Simulate SLA impact if we delay change window by 30 min',
  'Summarize trust and safety escalations for {tenant}',
  'Design follow-up sequence for VIP accounts in {tenant}',
]

const copilotPrompts = computed(() =>
  basePrompts.map(prompt => prompt.replace('{tenant}', selectedTenant.value.name)),
)

const signalOverrides = computed(() => {
  const state = selectedTenant.value.status === 'alert' ? 'alert' : selectedTenant.value.status === 'watch' ? 'watch' : 'stable'
  const label = state === 'alert' ? 'Alert' : state === 'watch' ? 'Watch' : 'Stable'

  return [
    {
      id: 'signal-global',
      label: 'Global latency',
      meta: '< 210ms across 9 regions - synthetic probes green',
      state: 'stable',
      stateLabel: 'Stable',
    },
    {
      id: 'signal-tenant',
      label: `${selectedTenant.value.name} watchlist`,
      meta: selectedTenant.value.statusLabel,
      state,
      stateLabel: label,
    },
    {
      id: 'signal-trust',
      label: 'Trust and safety window',
      meta: 'Guardrail 19 active - 45 min remaining',
      state: 'watch',
      stateLabel: 'Watch',
    },
  ] as Array<{ id: string; label: string; meta: string; state: 'stable' | 'watch' | 'alert'; stateLabel: string }>
})

const operatorName = computed(() => authStore.user?.name ?? 'Avi Ops')
const operatorEmail = computed(() => authStore.user?.email ?? 'ops@hummdesk.ai')

function computeInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return 'HD'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'H'
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const operatorInitials = computed(() => computeInitials(operatorName.value))

function selectTenant(id: string) {
  selectedTenantId.value = id
}

function handleCopilotAction(action: string) {
  switch (action) {
    case 'open_queue':
      router.push('/conversations')
      break
    case 'sync_ops':
      router.push('/teams')
      break
    case 'open_briefing':
      router.push('/knowledge-base')
      break
    case 'send_slack':
      console.info('Dispatching status update to Slack bridge')
      break
    case 'review_macro':
      router.push('/knowledge-base')
      break
    case 'open_training':
      router.push('/teams')
      break
    default:
      console.info('Unhandled copilot action:', action)
  }
}

function handleCopilotPrompt(prompt: string) {
  console.info('Copilot prompt requested:', prompt)
}

onMounted(() => {
  conversationsStore.initializeWebSocket()
  conversationsStore.fetchConversations()
})

onUnmounted(() => {
  conversationsStore.disconnectWebSocket()
})
</script>
<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: clamp(1.8rem, 3vw, 2.8rem);
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-6);
  padding: clamp(1.5rem, 3vw, 2.5rem);
  border-radius: var(--radius-2xl);
  background: rgba(7, 12, 28, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 28px 70px rgba(2, 8, 23, 0.45);
  backdrop-filter: blur(28px);
}

.dashboard__eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 0.35rem;
}

.dashboard__title {
  font-size: clamp(1.85rem, 2.4vw, 2.4rem);
  font-weight: var(--weight-semibold);
}

.dashboard__subtitle {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-top: 0.6rem;
}

.dashboard__operator {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-end;
}

.operator-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.operator-avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.45), rgba(59, 130, 246, 0.4));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--weight-semibold);
}

.operator-name {
  font-weight: var(--weight-medium);
}

.operator-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dashboard__grid {
  display: grid;
  gap: clamp(1.8rem, 3vw, 2.6rem);
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  align-items: start;
}

.dashboard__main {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 3vw, 2.4rem);
}

.tenant-rail {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.tenant-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: rgba(8, 15, 30, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 18px 40px rgba(2, 8, 23, 0.35);
  backdrop-filter: blur(22px);
  transition: all var(--duration-slow) var(--ease-out);
}

.tenant-card.active {
  border-color: rgba(34, 211, 238, 0.5);
}

.tenant-card:hover {
  transform: translateY(-4px);
  border-color: rgba(34, 211, 238, 0.3);
}

.tenant-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tenant-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: rgba(34, 211, 238, 0.2);
  color: rgba(34, 211, 238, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--weight-semibold);
}

.tenant-card__plan,
.tenant-card__trend {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.tenant-card__trend.trend-up {
  color: #22d3ee;
}

.tenant-card__trend.trend-down {
  color: #f59e0b;
}

.metric-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.metric-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: rgba(8, 14, 28, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.metric-card__icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.metric-card__value-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.metric-card__delta.up {
  color: #22d3ee;
}

.metric-card__delta.down {
  color: #f59e0b;
}

.dashboard-panels {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  background: rgba(7, 12, 28, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 24px 60px rgba(2, 8, 23, 0.45);
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.panel__status {
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel__status.stable {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.panel__status.watch {
  background: rgba(251, 191, 36, 0.18);
  color: #facc15;
}

.panel__status.alert {
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
}

.panel__grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.panel-metric {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: rgba(9, 16, 30, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.panel-metric__label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.panel__action {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.7);
  color: var(--text);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  transition: color var(--duration-normal) var(--ease-out);
}

.panel__action:hover {
  color: #22d3ee;
}

.timeline {
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  background: rgba(7, 12, 28, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 24px 60px rgba(2, 8, 23, 0.45);
}

.timeline__item {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: rgba(10, 15, 30, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.08);
}

.timeline__impact {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.timeline__impact.up {
  background: rgba(34, 197, 94, 0.14);
  color: #4ade80;
}

.timeline__impact.down {
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
}

.timeline__tag {
  font-size: 0.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
  margin-right: 0.35rem;
}

.dashboard__sidecar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  position: sticky;
  top: clamp(1.5rem, 3vw, 2.5rem);
}

.sidecard {
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  background: rgba(7, 14, 30, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 24px 60px rgba(2, 8, 23, 0.45);
}

.sidecard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.sidecard__badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-full);
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
}

.signal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: rgba(9, 16, 30, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.1);
  margin-top: var(--space-3);
}

.signal:first-child {
  margin-top: 0;
}

.signal__state {
  font-size: 0.75rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.signal__state.stable {
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
}

.signal__state.watch {
  background: rgba(251, 191, 36, 0.16);
  color: #fbbf24;
}

.signal__state.alert {
  background: rgba(248, 113, 113, 0.16);
  color: #f87171;
}

@media (max-width: 1280px) {
  .dashboard__grid {
    grid-template-columns: 1fr;
  }

  .dashboard__sidecar {
    position: static;
  }
}

@media (max-width: 960px) {
  .dashboard__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tenant-rail {
    grid-template-columns: 1fr;
  }

  .panel__grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .panel__grid {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .timeline__item {
    grid-template-columns: 1fr;
  }
}
</style>
