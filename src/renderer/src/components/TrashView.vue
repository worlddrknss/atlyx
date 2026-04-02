<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TrashItem {
  id: number
  name: string
  barcode: string
  category: string
  quantity: number
  location: string
  deleted_at: string
}

const items = ref<TrashItem[]>([])
const emptyConfirm = ref(false)

onMounted(async () => {
  items.value = (await window.api.listTrash()) as TrashItem[]
})

async function restoreItem(item: TrashItem): Promise<void> {
  await window.api.restoreItem(item.id)
  items.value = items.value.filter((i) => i.id !== item.id)
}

async function emptyTrash(): Promise<void> {
  if (!emptyConfirm.value) {
    emptyConfirm.value = true
    setTimeout(() => (emptyConfirm.value = false), 3000)
    return
  }
  await window.api.emptyTrash()
  items.value = []
  emptyConfirm.value = false
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">Trash</h2>
        <p class="text-xs text-text-muted mt-0.5">{{ items.length }} deleted items</p>
      </div>
      <button
        v-if="items.length"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="
          emptyConfirm
            ? 'text-white bg-red-500 hover:bg-red-600'
            : 'text-red-400 border border-red-400/30 hover:bg-red-400/10'
        "
        @click="emptyTrash"
      >
        {{ emptyConfirm ? 'Confirm Empty Trash' : 'Empty Trash' }}
      </button>
    </div>

    <div
      v-if="items.length"
      class="bg-surface-soft border border-border rounded-xl overflow-hidden"
    >
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Name
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Barcode
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Category
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Location
            </th>
            <th
              class="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Qty
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Deleted
            </th>
            <th
              class="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-b border-border/50 hover:bg-surface-mute/40 transition-colors"
          >
            <td class="px-4 py-3 text-sm text-text-primary font-medium">{{ item.name }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary font-mono">{{ item.barcode }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ item.category }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ item.location }}</td>
            <td class="px-4 py-3 text-sm text-text-primary text-right tabular-nums">
              {{ item.quantity }}
            </td>
            <td class="px-4 py-3 text-sm text-text-muted">{{ formatDate(item.deleted_at) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                class="px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 rounded-md transition-colors"
                @click="restoreItem(item)"
              >
                Restore
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="py-12 text-center">
      <p class="text-2xl mb-2">🗑️</p>
      <p class="text-sm text-text-muted">Trash is empty</p>
    </div>
  </div>
</template>
