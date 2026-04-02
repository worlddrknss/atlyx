<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import CreateItemModal from './CreateItemModal.vue'

interface InventoryItem {
  id: number
  name: string
  barcode: string
  quantity: number
}

interface BatchEntry {
  barcode: string
  item: InventoryItem | null
  timestamp: string
}

const scanInput = ref<HTMLInputElement | null>(null)
const currentBarcode = ref('')
const selectedItem = ref<InventoryItem | null>(null)
const scanned = ref(false)
const showCreateModal = ref(false)
const batchMode = ref(false)
const batchEntries = ref<BatchEntry[]>([])

async function lookup(): Promise<void> {
  const code = currentBarcode.value.trim()
  if (!code) return

  const found = (await window.api.getItemByBarcode(code)) as InventoryItem | null

  if (batchMode.value) {
    const now = new Date()
    batchEntries.value.unshift({
      barcode: code,
      item: found,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    })
    if (found) {
      await window.api.updateQuantity(found.id, found.quantity + 1)
      found.quantity += 1
    }
    currentBarcode.value = ''
    nextTick(() => scanInput.value?.focus())
    return
  }

  selectedItem.value = found
  scanned.value = true
}

async function adjustQuantity(delta: number): Promise<void> {
  if (!selectedItem.value) return
  const newQty = Math.max(0, selectedItem.value.quantity + delta)
  await window.api.updateQuantity(selectedItem.value.id, newQty)
  selectedItem.value.quantity = newQty
}

function openCreateModal(): void {
  showCreateModal.value = true
}

async function handleSave(newItem: { name: string; barcode: string; quantity: number }): Promise<void> {
  const created = (await window.api.createItem({
    name: newItem.name,
    barcode: newItem.barcode,
    category: '',
    quantity: newItem.quantity,
    location: ''
  })) as InventoryItem
  selectedItem.value = created
  showCreateModal.value = false
}

function resetScan(): void {
  currentBarcode.value = ''
  selectedItem.value = null
  scanned.value = false
  nextTick(() => scanInput.value?.focus())
}

function toggleBatch(): void {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    batchEntries.value = []
  }
  resetScan()
}

function clearBatch(): void {
  batchEntries.value = []
  nextTick(() => scanInput.value?.focus())
}

onMounted(() => {
  scanInput.value?.focus()
})
</script>

<template>
  <div class="flex-1 flex flex-col items-center pt-24 px-6">
    <!-- Mode toggle -->
    <div class="w-full max-w-lg flex items-center justify-end mb-4">
      <button
        class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
        :class="batchMode ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border text-text-muted hover:text-text-secondary'"
        @click="toggleBatch"
      >
        <span>{{ batchMode ? '⚡ Batch Mode ON' : 'Batch Mode' }}</span>
      </button>
    </div>

    <!-- Scan Input -->
    <div class="w-full max-w-lg">
      <div class="relative">
        <input
          ref="scanInput"
          v-model="currentBarcode"
          type="text"
          :placeholder="batchMode ? 'Batch scan — each Enter adds +1 qty…' : 'Scan barcode or enter code…'"
          class="w-full bg-surface-soft border border-border rounded-xl px-5 py-4 text-base text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all font-mono tracking-wider"
          @keydown.enter="lookup"
        />
        <span
          v-if="currentBarcode"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors"
          @click="resetScan"
        >
          Clear
        </span>
      </div>
      <p class="text-xs text-text-muted mt-2 text-center">
        Press <kbd class="px-1.5 py-0.5 rounded bg-surface-mute border border-border text-[10px] font-mono">Enter</kbd> to look up
      </p>
    </div>

    <!-- Result Panel -->
    <div v-if="scanned" class="w-full max-w-lg mt-10">
      <!-- Item Found -->
      <div v-if="selectedItem" class="bg-surface-soft border border-border rounded-xl p-6">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-xl font-bold text-text-primary">{{ selectedItem.name }}</h3>
            <p class="text-sm font-mono text-text-muted mt-1">{{ selectedItem.barcode }}</p>
          </div>
          <button
            class="text-xs text-text-muted hover:text-text-secondary transition-colors"
            @click="resetScan"
          >
            New Scan
          </button>
        </div>

        <div class="mt-6 flex items-center gap-6">
          <div class="flex items-center gap-3">
            <button
              class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-mute border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors text-lg font-medium"
              @click="adjustQuantity(-1)"
            >
              −
            </button>
            <span class="text-2xl font-bold text-text-primary tabular-nums min-w-[3ch] text-center">
              {{ selectedItem.quantity }}
            </span>
            <button
              class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-mute border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors text-lg font-medium"
              @click="adjustQuantity(1)"
            >
              +
            </button>
          </div>

          <button class="ml-auto px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors">
            Print Label
          </button>
        </div>
      </div>

      <!-- Item Not Found -->
      <div v-else class="bg-surface-soft border border-border rounded-xl p-6 text-center">
        <p class="text-text-secondary text-sm">No item found for</p>
        <p class="text-text-primary font-mono text-base mt-1">{{ currentBarcode }}</p>
        <button
          class="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          @click="openCreateModal"
        >
          Create New Item
        </button>
      </div>
    </div>

    <!-- Create Item Modal -->
    <CreateItemModal
      v-if="showCreateModal"
      :barcode="currentBarcode"
      @close="showCreateModal = false"
      @save="handleSave"
    />

    <!-- Batch Results -->
    <div v-if="batchMode && batchEntries.length > 0" class="w-full max-w-lg mt-8">
      <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 class="text-sm font-semibold text-text-primary">Batch Log ({{ batchEntries.length }} scans)</h3>
          <button class="text-xs text-text-muted hover:text-text-secondary transition-colors" @click="clearBatch">
            Clear
          </button>
        </div>
        <div class="max-h-64 overflow-y-auto divide-y divide-border/50">
          <div
            v-for="(entry, i) in batchEntries"
            :key="i"
            class="px-5 py-3 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-6 h-6 rounded flex items-center justify-center text-xs font-semibold"
                :class="entry.item ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'"
              >
                {{ entry.item ? '✓' : '?' }}
              </span>
              <div>
                <p class="text-sm text-text-primary">{{ entry.item?.name ?? 'Unknown item' }}</p>
                <p class="text-xs font-mono text-text-muted">{{ entry.barcode }}</p>
              </div>
            </div>
            <span class="text-[11px] text-text-muted tabular-nums">{{ entry.timestamp }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
