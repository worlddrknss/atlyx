<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface InventoryItem {
  id: number
  name: string
  barcode: string
  category: string
  quantity: number
  location: string
}

const search = ref('')
const items = ref<InventoryItem[]>([])
const locations = ref<string[]>([])
const showCreateModal = ref(false)

const form = ref({ name: '', barcode: '', category: '', quantity: 1, location: '' })

onMounted(async () => {
  items.value = (await window.api.listItems()) as InventoryItem[]
  const locs = await window.api.listLocations()
  locations.value = locs.map((l) => l.name)
})

const filteredItems = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.barcode.includes(q) ||
      i.category.toLowerCase().includes(q)
  )
})

async function createItem(): Promise<void> {
  if (!form.value.name.trim() || !form.value.barcode.trim()) return
  const created = (await window.api.createItem({
    name: form.value.name.trim(),
    barcode: form.value.barcode.trim(),
    category: form.value.category.trim(),
    quantity: form.value.quantity,
    location: form.value.location
  })) as InventoryItem
  items.value.push(created)
  showCreateModal.value = false
  form.value = { name: '', barcode: '', category: '', quantity: 1, location: '' }
}

function deriveStatus(qty: number): string {
  if (qty === 0) return 'Out of Stock'
  if (qty <= 5) return 'Low Stock'
  return 'In Stock'
}

function statusColor(status: string): string {
  if (status === 'In Stock') return 'text-emerald-400 bg-emerald-400/10'
  if (status === 'Low Stock') return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">All Items</h2>
        <p class="text-xs text-text-muted mt-0.5">{{ items.length }} items in inventory</p>
      </div>
      <div class="flex items-center gap-3">
        <input
          v-model="search"
          type="text"
          placeholder="Search items…"
          class="bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors w-64"
        />
        <button
          class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          @click="showCreateModal = true"
        >
          + Add Item
        </button>
      </div>
    </div>

    <!-- Create Item Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCreateModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Add New Item</h2>
          <p class="text-xs text-text-muted mt-1">Add a new item to your inventory</p>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Item Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Wireless Mouse"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Barcode</label>
            <input
              v-model="form.barcode"
              type="text"
              placeholder="e.g. 4901234567890"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
              <input
                v-model="form.category"
                type="text"
                placeholder="e.g. Electronics"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Quantity</label>
              <input
                v-model.number="form.quantity"
                type="number"
                min="0"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Location</label>
            <select
              v-model="form.location"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option value="">No location</option>
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
            @click="showCreateModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            @click="createItem"
          >
            Save Item
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Name</th>
            <th class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Barcode</th>
            <th class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Category</th>
            <th class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Location</th>
            <th class="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Qty</th>
            <th class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredItems"
            :key="item.id"
            class="border-b border-border/50 hover:bg-surface-mute/40 transition-colors cursor-pointer"
          >
            <td class="px-4 py-3 text-sm text-text-primary font-medium">{{ item.name }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary font-mono">{{ item.barcode }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ item.category }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ item.location }}</td>
            <td class="px-4 py-3 text-sm text-text-primary text-right tabular-nums">{{ item.quantity }}</td>
            <td class="px-4 py-3">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-md" :class="statusColor(deriveStatus(item.quantity))">
                {{ deriveStatus(item.quantity) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredItems.length === 0" class="py-12 text-center">
        <p class="text-sm text-text-muted">No items match your search</p>
      </div>
    </div>
  </div>
</template>
