<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  barcode: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', item: { name: string; barcode: string; quantity: number }): void
}>()

const name = ref('')
const quantity = ref(1)

function handleSave(): void {
  if (!name.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    barcode: props.barcode,
    quantity: quantity.value
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
      <div class="px-6 py-5 border-b border-border">
        <h2 class="text-base font-semibold text-text-primary">Create New Item</h2>
        <p class="text-xs text-text-muted mt-1">Item not found — add it to inventory</p>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1.5">Item Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="e.g. Wireless Mouse"
            class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            autofocus
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1.5">Barcode</label>
          <input
            :value="barcode"
            type="text"
            readonly
            class="w-full bg-surface-mute border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted font-mono cursor-not-allowed"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1.5">Starting Quantity</label>
          <input
            v-model.number="quantity"
            type="number"
            min="0"
            class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
          />
        </div>
      </div>

      <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          @click="handleSave"
        >
          Save Item
        </button>
      </div>
    </div>
  </div>
</template>
