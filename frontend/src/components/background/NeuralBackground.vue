<template>
  <div class="neural-background" aria-hidden="true">
    <div class="neural-background__gradients">
      <span class="gradient gradient--primary" />
      <span class="gradient gradient--accent" />
      <span class="gradient gradient--violet" />
    </div>

    <div class="neural-background__mesh">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mesh-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(34, 211, 238, 0.35)" />
            <stop offset="50%" stop-color="rgba(99, 102, 241, 0.2)" />
            <stop offset="100%" stop-color="rgba(14, 165, 233, 0.15)" />
          </linearGradient>
        </defs>
        <g stroke="url(#mesh-stroke)" stroke-width="0.7" fill="none">
          <path
            v-for="line in meshLines"
            :key="line.id"
            :d="line.d"
            :style="{ animationDelay: line.delay }"
            class="mesh-line"
          />
        </g>
      </svg>
    </div>

    <div class="neural-background__nodes">
      <span
        v-for="node in nodes"
        :key="node.id"
        class="node"
        :style="{
          top: node.top,
          left: node.left,
          width: node.size,
          height: node.size,
          animationDelay: node.delay,
          animationDuration: node.duration,
        }"
      />
    </div>

    <div class="neural-background__orbits">
      <div
        v-for="orbit in orbits"
        :key="orbit.id"
        class="orbit"
        :style="{
          width: orbit.size,
          height: orbit.size,
          animationDuration: orbit.duration,
        }"
      >
        <span class="orbit__particle" :style="{ animationDuration: orbit.duration }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type MeshLine = {
  id: string
  d: string
  delay: string
}

type Node = {
  id: string
  top: string
  left: string
  size: string
  delay: string
  duration: string
}

type Orbit = {
  id: string
  size: string
  duration: string
}

const meshLines: MeshLine[] = [
  { id: 'mesh-1', d: 'M0 120 Q360 80 720 130 T1440 110', delay: '-2s' },
  { id: 'mesh-2', d: 'M0 260 Q320 300 720 260 T1440 280', delay: '-4s' },
  { id: 'mesh-3', d: 'M0 420 Q400 380 720 430 T1440 400', delay: '-1s' },
  { id: 'mesh-4', d: 'M0 580 Q360 640 720 600 T1440 620', delay: '-5s' },
  { id: 'mesh-5', d: 'M0 760 Q320 720 720 770 T1440 740', delay: '-3s' },
]

const nodes: Node[] = [
  { id: 'node-1', top: '12%', left: '18%', size: '10px', delay: '-1s', duration: '16s' },
  { id: 'node-2', top: '28%', left: '32%', size: '14px', delay: '-6s', duration: '22s' },
  { id: 'node-3', top: '22%', left: '64%', size: '11px', delay: '-3s', duration: '18s' },
  { id: 'node-4', top: '38%', left: '78%', size: '9px', delay: '-9s', duration: '20s' },
  { id: 'node-5', top: '54%', left: '14%', size: '12px', delay: '-5s', duration: '24s' },
  { id: 'node-6', top: '62%', left: '35%', size: '8px', delay: '-12s', duration: '19s' },
  { id: 'node-7', top: '68%', left: '52%', size: '15px', delay: '-8s', duration: '26s' },
  { id: 'node-8', top: '76%', left: '70%', size: '11px', delay: '-2s', duration: '23s' },
  { id: 'node-9', top: '44%', left: '58%', size: '9px', delay: '-14s', duration: '17s' },
  { id: 'node-10', top: '32%', left: '85%', size: '13px', delay: '-10s', duration: '21s' },
  { id: 'node-11', top: '16%', left: '50%', size: '7px', delay: '-7s', duration: '18s' },
  { id: 'node-12', top: '84%', left: '42%', size: '10px', delay: '-4s', duration: '24s' },
]

const orbits: Orbit[] = [
  { id: 'orbit-1', size: '380px', duration: '28s' },
  { id: 'orbit-2', size: '240px', duration: '32s' },
  { id: 'orbit-3', size: '520px', duration: '36s' },
]
</script>

<style scoped>
.neural-background {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    circle at 20% 20%,
    rgba(59, 130, 246, 0.18),
    transparent 45%
  );
}

.neural-background__gradients {
  position: absolute;
  inset: -20%;
  filter: blur(120px);
  opacity: 0.8;
  animation: breathe 18s ease-in-out infinite;
}

.gradient {
  position: absolute;
  border-radius: 9999px;
  mix-blend-mode: screen;
}

.gradient--primary {
  width: 640px;
  height: 640px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.4), transparent 65%);
  top: 20%;
  left: 18%;
}

.gradient--accent {
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.55), transparent 70%);
  bottom: 18%;
  right: 10%;
}

.gradient--violet {
  width: 740px;
  height: 740px;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.45), transparent 60%);
  top: 50%;
  left: 55%;
}

.neural-background__mesh {
  position: absolute;
  inset: 0;
  opacity: 0.45;
}

.mesh-line {
  animation: float-line 18s ease-in-out infinite;
}

.neural-background__nodes {
  position: absolute;
  inset: 0;
}

.node {
  position: absolute;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(226, 232, 240, 0.9), rgba(226, 232, 240, 0.1));
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.35);
  animation-name: drift-node;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.neural-background__orbits {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.24;
}

.orbit {
  position: absolute;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 9999px;
  animation: rotate-orbit linear infinite;
}

.orbit__particle {
  position: absolute;
  width: 12px;
  height: 12px;
  top: 50%;
  left: 100%;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  background: rgba(34, 211, 238, 0.75);
  box-shadow: 0 0 16px rgba(34, 211, 238, 0.75);
  animation: orbit-pulse ease-in-out infinite;
}

@keyframes float-line {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-18px);
  }
}

@keyframes drift-node {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translate3d(12px, -18px, 0) scale(1.08);
    opacity: 1;
  }
}

@keyframes rotate-orbit {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes orbit-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.65;
  }
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.95;
  }
}

@media (max-width: 768px) {
  .gradient--primary,
  .gradient--accent,
  .gradient--violet {
    width: 320px;
    height: 320px;
  }

  .mesh-line {
    stroke-width: 0.4;
  }
}
</style>
