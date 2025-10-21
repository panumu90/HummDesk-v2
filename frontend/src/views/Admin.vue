<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="glass border-b border-white/10 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">Admin Portal</h1>
            <p class="text-sm text-white/70">System Management & Analytics</p>
          </div>
          <button @click="router.push('/dashboard')" class="btn-secondary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Analytics Overview -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="glass-card">
          <h3 class="text-sm font-medium text-white/70 mb-2">Total Conversations</h3>
          <p class="text-4xl font-bold mb-2">1,247</p>
          <p class="text-sm text-green-400">+12% from last week</p>
        </div>
        <div class="glass-card">
          <h3 class="text-sm font-medium text-white/70 mb-2">Avg CSAT Score</h3>
          <p class="text-4xl font-bold mb-2">4.8</p>
          <p class="text-sm text-green-400">+0.3 from last week</p>
        </div>
        <div class="glass-card">
          <h3 class="text-sm font-medium text-white/70 mb-2">SLA Compliance</h3>
          <p class="text-4xl font-bold mb-2">94%</p>
          <p class="text-sm text-yellow-400">-2% from last week</p>
        </div>
      </div>

      <!-- Teams Performance -->
      <div class="glass-card mb-8">
        <h2 class="text-xl font-bold mb-6">Team Performance</h2>
        <div class="space-y-4">
          <div v-for="team in teams" :key="team.id" class="glass p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-semibold">{{ team.name }}</h3>
                <p class="text-sm text-white/70">{{ team.agentCount }} agents</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold">{{ team.utilization }}%</p>
                <p class="text-sm text-white/70">Utilization</p>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p class="text-white/70">Avg Response Time</p>
                <p class="font-semibold">{{ team.avgResponseTime }}</p>
              </div>
              <div>
                <p class="text-white/70">CSAT Score</p>
                <p class="font-semibold">{{ team.csatScore }}</p>
              </div>
              <div>
                <p class="text-white/70">Resolution Rate</p>
                <p class="font-semibold">{{ team.resolutionRate }}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Performance -->
      <div class="glass-card">
        <h2 class="text-xl font-bold mb-6">AI Performance Metrics</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="glass p-4">
            <h3 class="font-semibold mb-2">Classification Accuracy</h3>
            <p class="text-3xl font-bold mb-2">96.8%</p>
            <p class="text-sm text-white/70">Based on agent feedback</p>
          </div>
          <div class="glass p-4">
            <h3 class="font-semibold mb-2">Draft Acceptance Rate</h3>
            <p class="text-3xl font-bold mb-2">78.5%</p>
            <p class="text-sm text-white/70">Agents using AI suggestions</p>
          </div>
          <div class="glass p-4">
            <h3 class="font-semibold mb-2">Avg Draft Confidence</h3>
            <p class="text-3xl font-bold mb-2">87.2%</p>
            <p class="text-sm text-white/70">AI confidence score</p>
          </div>
          <div class="glass p-4">
            <h3 class="font-semibold mb-2">Time Saved</h3>
            <p class="text-3xl font-bold mb-2">142h</p>
            <p class="text-sm text-white/70">This week</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const teams = ref([
  {
    id: '1',
    name: 'Billing Team',
    agentCount: 4,
    utilization: 67,
    avgResponseTime: '1.8m',
    csatScore: 4.9,
    resolutionRate: 94,
  },
  {
    id: '2',
    name: 'Technical Support',
    agentCount: 4,
    utilization: 82,
    avgResponseTime: '2.1m',
    csatScore: 4.7,
    resolutionRate: 89,
  },
  {
    id: '3',
    name: 'Sales Team',
    agentCount: 2,
    utilization: 45,
    avgResponseTime: '1.5m',
    csatScore: 5.0,
    resolutionRate: 96,
  },
])
</script>
