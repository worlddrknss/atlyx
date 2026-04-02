<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Item {
  id: number
  name: string
  barcode: string
  category: string
  quantity: number
  min_quantity: number
  location: string
  retail_value: number
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

interface OverdueCheckout {
  id: number
  item_name: string
  item_barcode: string
  checked_out_to: string
  due_date: string
}

interface DashboardStats {
  totalItems: number
  totalUnits: number
  totalValue: number
  categoryBreakdown: Array<{ name: string; count: number }>
}

const items = ref<Item[]>([])
const locations = ref<Location[]>([])
const activities = ref<Activity[]>([])
const overdueCheckouts = ref<OverdueCheckout[]>([])
const dashStats = ref<DashboardStats>({
  totalItems: 0,
  totalUnits: 0,
  totalValue: 0,
  categoryBreakdown: []
})
const overdueCount = ref(0)
const activeCheckoutCount = ref(0)

const LOW_STOCK_FALLBACK = 5

const stats = computed(() => {
  const lowStock = items.value.filter((i) => {
    const threshold = i.min_quantity > 0 ? i.min_quantity : LOW_STOCK_FALLBACK
    return i.quantity > 0 && i.quantity <= threshold
  }).length
  return [
    {
      label: 'Total Items',
      value: dashStats.value.totalItems,
      trend: `${dashStats.value.totalUnits} units`,
      icon: '☰'
    },
    {
      label: 'Inventory Value',
      value: `$${dashStats.value.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: '',
      icon: '⊞'
    },
    {
      label: 'Low Stock',
      value: lowStock,
      trend: lowStock ? 'Needs attention' : 'All good',
      icon: '⚠',
      alert: lowStock > 0
    },
    {
      label: 'Overdue',
      value: overdueCount.value,
      trend: overdueCount.value ? 'Action required' : 'None',
      icon: '⏱',
      alert: overdueCount.value > 0
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
    .filter((i) => {
      const threshold = i.min_quantity > 0 ? i.min_quantity : LOW_STOCK_FALLBACK
      return i.quantity > 0 && i.quantity <= threshold
    })
    .sort((a, b) => a.quantity - b.quantity)
    .map((i) => ({
      name: i.name,
      quantity: i.quantity,
      threshold: i.min_quantity > 0 ? i.min_quantity : LOW_STOCK_FALLBACK
    }))
)

const locationBreakdown = computed(() => {
  const total = items.value.length || 1
  return locations.value.map((l) => ({
    name: l.name,
    items: l.itemCount,
    percentage: Math.round((l.itemCount / total) * 100)
  }))
})

const categoryColors = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899'
]

const maxCategoryCount = computed(() => {
  const max = Math.max(...dashStats.value.categoryBreakdown.map((c) => c.count), 1)
  return max
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
  const [i, l, a, odc, odCount, activeCount, ds] = await Promise.all([
    window.api.listItems(),
    window.api.listLocations(),
    window.api.listActivity(20),
    window.api.getOverdueCheckouts(),
    window.api.getOverdueCount(),
    window.api.getActiveCheckoutCount(),
    window.api.getDashboardStats()
  ])
  items.value = i as Item[]
  locations.value = l
  activities.value = a
  overdueCheckouts.value = odc as OverdueCheckout[]
  overdueCount.value = odCount
  activeCheckoutCount.value = activeCount
  dashStats.value = ds
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

    <div class="grid grid-cols-3 gap-4 mb-4">
      <!-- Recent activity -->
      <div class="col-span-2 bg-surface-soft border border-border rounded-xl">
        <div class="px-5 py-4 border-b border-border">
          <h3 class="text-sm font-semibold text-text-primary">Recent Activity</h3>
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
        <!-- Overdue checkouts -->
        <div
          v-if="overdueCheckouts.length"
          class="bg-surface-soft border border-red-500/30 rounded-xl"
        >
          <div class="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 class="text-sm font-semibold text-red-400">Overdue Checkouts</h3>
            <span
              class="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full"
              >{{ overdueCheckouts.length }}</span
            >
          </div>
          <div class="p-4 space-y-3">
            <div
              v-for="oc in overdueCheckouts.slice(0, 4)"
              :key="oc.id"
              class="flex items-center justify-between"
            >
              <div class="min-w-0">
                <p class="text-sm text-text-primary truncate">{{ oc.item_name }}</p>
                <p class="text-[11px] text-text-muted">→ {{ oc.checked_out_to }}</p>
              </div>
              <span class="text-[10px] font-medium text-red-400 shrink-0 ml-2">
                Due {{ new Date(oc.due_date).toLocaleDateString() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Low stock alerts -->
        <div class="bg-surface-soft border border-border rounded-xl">
          <div class="px-5 py-4 border-b border-border">
            <h3 class="text-sm font-semibold text-text-primary">Low Stock Alerts</h3>
          </div>
          <div class="p-5 space-y-4">
            <div v-if="!lowStockItems.length" class="text-xs text-text-muted italic">
              All items well stocked
            </div>
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
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Category breakdown chart -->
      <div class="bg-surface-soft border border-border rounded-xl">
        <div class="px-5 py-4 border-b border-border">
          <h3 class="text-sm font-semibold text-text-primary">By Category</h3>
        </div>
        <div class="p-5 space-y-3">
          <div v-if="!dashStats.categoryBreakdown.length" class="text-xs text-text-muted italic">
            No categories yet
          </div>
          <div
            v-for="(cat, idx) in dashStats.categoryBreakdown"
            :key="cat.name"
            class="flex items-center gap-3"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :style="{ backgroundColor: categoryColors[idx % categoryColors.length] }"
            />
            <p class="text-sm text-text-secondary flex-1 truncate">{{ cat.name }}</p>
            <div class="w-24 h-1.5 bg-surface-mute rounded-full overflow-hidden">
              <div
                class="h-full rounded-full"
                :style="{
                  width: (cat.count / maxCategoryCount) * 100 + '%',
                  backgroundColor: categoryColors[idx % categoryColors.length]
                }"
              />
            </div>
            <span class="text-xs text-text-muted tabular-nums w-6 text-right">{{ cat.count }}</span>
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
</template>
