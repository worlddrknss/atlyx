<script setup lang="ts">
defineProps<{
  activeView: string
}>()

const emit = defineEmits<{
  (e: 'navigate', view: string): void
}>()

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'scan', label: 'Scan', icon: '⎋' },
  { id: 'items', label: 'Items', icon: '☰' },
  { id: 'locations', label: 'Locations', icon: '◎' },
  { id: 'labels', label: 'Barcodes', icon: '⊞' },
  { id: 'activity', label: 'Activity', icon: '↻' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]
</script>

<template>
  <aside class="w-56 shrink-0 bg-surface-soft border-r border-border flex flex-col select-none">
    <div class="px-5 pt-6 pb-8">
      <h1 class="text-lg font-bold tracking-wide text-text-primary">Atlyx</h1>
      <p class="text-[10px] uppercase tracking-[3px] text-text-muted mt-0.5">Inventory</p>
    </div>

    <nav class="flex-1 px-3">
      <ul class="space-y-0.5">
        <li
          v-for="item in navItems"
          :key="item.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors duration-150"
          :class="
            activeView === item.id
              ? 'bg-surface-mute text-text-primary font-medium'
              : 'text-text-secondary hover:bg-surface-mute/50 hover:text-text-primary'
          "
          @click="emit('navigate', item.id)"
        >
          <span class="text-base opacity-60">{{ item.icon }}</span>
          {{ item.label }}
        </li>
      </ul>
    </nav>

    <div class="px-5 py-4 border-t border-border">
      <p class="text-[10px] uppercase tracking-widest text-text-muted">v1.0.0</p>
    </div>
  </aside>
</template>
