<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Item {
  id: number
  name: string
  barcode: string
  category: string
  quantity: number
  location: string
}

interface Location {
  id: number
  name: string
  itemCount: number
}

interface Activity {
  id: number
  type: string
  item_name: string
  barcode: string
  detail: string
  timestamp: string
}

const items = ref<Item[]>([])
const locations = ref<Location[]>([])
const activities = ref<Activity[]>([])

const LOW_STOCK_THRESHOLD = 5

const stats = computed(() => {
  const totalUnits = items.value.reduce((sum, i) => sum + i.quantity, 0)
  const lowStock = items.value.filter(
    (i) => i.quantity > 0 && i.quantity <= LOW_STOCK_THRESHOLD
  ).length
  const emptyLocations = locations.value.filter((l) => l.itemCount === 0).length
  return [
    {
      label: 'Total Items',
      value: items.value.length,
      trend: `${totalUnits} total units`,
      icon: '☰'
    },
    { label: 'Total Units', value: totalUnits, trend: '', icon: '⊞' },
    {
      label: 'Low Stock',
      value: lowStock,
      trend: lowStock ? 'Needs attention' : 'All good',
      icon: '⚠',
      alert: lowStock > 0
    },
    {
      label: 'Locations',
      value: locations.value.length,
      trend: emptyLocations ? `${emptyLocations} empty` : 'All active',
      icon: '◎'
    }
  ]
})

const recentScans = computed(() =>
  activities.value.slice(0, 5).map((a) => ({
    id: a.id,
    item: a.item_name || 'System',
    barcode: a.barcode,
    action: a.type.charAt(0).toUpperCase() + a.type.slice(1),
    time: formatRelative(a.timestamp)
  }))
)

const lowStockItems = computed(() =>
  items.value
    .filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.quantity - b.quantity)
    .map((i) => ({ name: i.name, quantity: i.quantity, threshold: LOW_STOCK_THRESHOLD }))
)

const locationBreakdown = computed(() => {
  const total = items.value.length || 1
  return locations.value.map((l) => ({
    name: l.name,
    items: l.itemCount,
    percentage: Math.round((l.itemCount / total) * 100)
  }))
})

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

onMounted(async () => {
  const [i, l, a] = await Promise.all([
    window.api.listItems(),
    window.api.listLocations(),
    window.api.listActivity(20)
  ])
  items.value = i
  locations.value = l
  activities.value = a
})
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h2 class="text-lg font-bold text-text-primary">Dashboard</h2>
      <p class="text-xs text-text-muted mt-0.5">Overview of your inventory</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-surface-soft border border-border rounded-xl p-5"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-lg opacity-50">{{ stat.icon }}</span>
          <span
            class="text-[11px] font-medium px-2 py-0.5 rounded-md"
            :class="
              stat.alert ? 'text-amber-400 bg-amber-400/10' : 'text-text-muted bg-surface-mute'
            "
          >
            {{ stat.trend }}
          </span>
        </div>
        <p class="text-2xl font-bold text-text-primary tabular-nums">{{ stat.value }}</p>
        <p class="text-xs text-text-muted mt-0.5">{{ stat.label }}</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <!-- Recent activity -->
      <div class="col-span-2 bg-surface-soft border border-border rounded-xl">
        <div class="px-5 py-4 border-b border-border">
          <h3 class="text-sm font-semibold text-text-primary">Recent Scans</h3>
        </div>
        <div class="divide-y divide-border/50">
          <div
            v-for="scan in recentScans"
            :key="scan.id"
            class="px-5 py-3 flex items-center justify-between hover:bg-surface-mute/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg bg-surface-mute flex items-center justify-center text-xs text-text-muted"
              >
                ⎋
              </div>
              <div>
                <p class="text-sm font-medium text-text-primary">{{ scan.item }}</p>
                <p class="text-xs font-mono text-text-muted">{{ scan.barcode }}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs font-medium text-text-secondary">{{ scan.action }}</p>
              <p class="text-[11px] text-text-muted">{{ scan.time }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-4">
        <!-- Low stock alerts -->
        <div class="bg-surface-soft border border-border rounded-xl">
          <div class="px-5 py-4 border-b border-border">
            <h3 class="text-sm font-semibold text-text-primary">Low Stock Alerts</h3>
          </div>
          <div class="p-5 space-y-4">
            <div v-for="item in lowStockItems" :key="item.name">
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-sm text-text-primary">{{ item.name }}</p>
                <span class="text-xs font-semibold text-amber-400"
                  >{{ item.quantity }}/{{ item.threshold }}</span
                >
              </div>
              <div class="h-1.5 bg-surface-mute rounded-full overflow-hidden">
                <div
                  class="h-full bg-amber-400 rounded-full"
                  :style="{ width: Math.min(100, (item.quantity / item.threshold) * 100) + '%' }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Location breakdown -->
        <div class="bg-surface-soft border border-border rounded-xl">
          <div class="px-5 py-4 border-b border-border">
            <h3 class="text-sm font-semibold text-text-primary">By Location</h3>
          </div>
          <div class="p-5 space-y-3">
            <div
              v-for="loc in locationBreakdown"
              :key="loc.name"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <p class="text-sm text-text-secondary truncate">{{ loc.name }}</p>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-16 h-1.5 bg-surface-mute rounded-full overflow-hidden">
                  <div
                    class="h-full bg-accent rounded-full"
                    :style="{ width: loc.percentage + '%' }"
                  />
                </div>
                <span class="text-xs text-text-muted tabular-nums w-6 text-right">{{
                  loc.items
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
