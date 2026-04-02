<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface ActivityEntry {
  id: number
  type: 'scan' | 'create' | 'update' | 'delete' | 'print'
  item_name: string
  barcode: string
  detail: string
  timestamp: string
}

const filter = ref('all')
const activities = ref<ActivityEntry[]>([])

onMounted(async () => {
  activities.value = (await window.api.listActivity(100)) as ActivityEntry[]
})

const filters = [
  { id: 'all', label: 'All' },
  { id: 'scan', label: 'Scans' },
  { id: 'create', label: 'Created' },
  { id: 'update', label: 'Updated' },
  { id: 'print', label: 'Printed' },
  { id: 'delete', label: 'Deleted' }
]

const filteredActivities = computed(() => {
  if (filter.value === 'all') return activities.value
  return activities.value.filter((a) => a.type === filter.value)
})

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    scan: '⎋',
    create: '+',
    update: '↻',
    delete: '✕',
    print: '⎙'
  }
  return icons[type] ?? '•'
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    scan: 'text-blue-400 bg-blue-400/10',
    create: 'text-emerald-400 bg-emerald-400/10',
    update: 'text-amber-400 bg-amber-400/10',
    delete: 'text-red-400 bg-red-400/10',
    print: 'text-purple-400 bg-purple-400/10'
  }
  return colors[type] ?? 'text-text-muted bg-surface-mute'
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">Activity Log</h2>
        <p class="text-xs text-text-muted mt-0.5">{{ activities.length }} events recorded</p>
      </div>
      <div class="flex items-center gap-1 bg-surface-soft border border-border rounded-lg p-0.5">
        <button
          v-for="f in filters"
          :key="f.id"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="
            filter === f.id
              ? 'bg-surface-mute text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          "
          @click="filter = f.id"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <div
        v-for="(entry, i) in filteredActivities"
        :key="entry.id"
        class="flex items-center gap-4 px-5 py-4 hover:bg-surface-mute/30 transition-colors"
        :class="i < filteredActivities.length - 1 ? 'border-b border-border/50' : ''"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          :class="typeColor(entry.type)"
        >
          {{ typeIcon(entry.type) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium text-text-primary truncate">
              {{ entry.item_name || 'System' }}
            </p>
            <span class="text-[11px] font-mono text-text-muted">{{ entry.barcode }}</span>
          </div>
          <p class="text-xs text-text-secondary mt-0.5">{{ entry.detail }}</p>
        </div>
        <p class="text-[11px] text-text-muted shrink-0 tabular-nums">{{ entry.timestamp }}</p>
      </div>

      <div v-if="filteredActivities.length === 0" class="py-12 text-center">
        <p class="text-sm text-text-muted">No activity matching this filter</p>
      </div>
    </div>
  </div>
</template>
