<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Label {
  id: number
  name: string
  barcode: string
  notes: string
  created_at: string
  barcodeImg: string | null
}

const labels = ref<Label[]>([])
const selectedSize = ref('small')
const sizes = ['small', 'medium', 'large']

// Create modal state
const showCreate = ref(false)
const form = ref({ name: '', barcode: '', notes: '' })
const formError = ref('')
const creating = ref(false)

onMounted(async () => {
  await loadLabels()
})

async function loadLabels(): Promise<void> {
  const raw = await window.api.listLabels()
  labels.value = (raw as Label[]).map((l) => ({ ...l, barcodeImg: null }))
  await generateAllBarcodes()
}

async function generateAllBarcodes(): Promise<void> {
  await Promise.all(
    labels.value.map(async (label) => {
      try {
        const base64 = await window.api.generateBarcode(label.barcode, { scale: 2 })
        label.barcodeImg = `data:image/png;base64,${base64}`
      } catch {
        // keep null
      }
    })
  )
}

function generateBarcodeValue(): string {
  // Generate a random 12-digit barcode (EAN-13 compatible body)
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
  return `ATX${digits}`
}

function openCreate(): void {
  form.value = { name: '', barcode: generateBarcodeValue(), notes: '' }
  formError.value = ''
  showCreate.value = true
}

async function saveLabel(): Promise<void> {
  const { name, barcode } = form.value
  if (!name.trim()) {
    formError.value = 'Name is required'
    return
  }
  if (!barcode.trim()) {
    formError.value = 'Barcode value is required'
    return
  }
  creating.value = true
  formError.value = ''
  try {
    await window.api.createLabel({
      name: name.trim(),
      barcode: barcode.trim(),
      notes: form.value.notes.trim()
    })
    showCreate.value = false
    await loadLabels()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE constraint')) {
      formError.value = 'A label with this barcode already exists'
    } else {
      formError.value = 'Failed to create label'
    }
  } finally {
    creating.value = false
  }
}

async function deleteLabel(id: number): Promise<void> {
  await window.api.deleteLabel(id)
  labels.value = labels.value.filter((l) => l.id !== id)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">Barcodes</h2>
        <p class="text-xs text-text-muted mt-0.5">
          Create barcodes for items that don't have one
        </p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Size selector -->
        <div
          class="flex items-center bg-surface-soft border border-border rounded-lg overflow-hidden"
        >
          <button
            v-for="size in sizes"
            :key="size"
            class="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
            :class="
              selectedSize === size
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="selectedSize = size"
          >
            {{ size }}
          </button>
        </div>
        <button
          class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          @click="openCreate"
        >
          + Create Label
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="labels.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="text-4xl opacity-30 mb-4">⊞</div>
      <p class="text-sm text-text-secondary mb-1">No barcodes yet</p>
      <p class="text-xs text-text-muted mb-4">
        Create a barcode label for items that don't already have one
      </p>
      <button
        class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
        @click="openCreate"
      >
        + Create Label
      </button>
    </div>

    <!-- Label cards -->
    <div v-else class="space-y-3">
      <div
        v-for="label in labels"
        :key="label.id"
        class="bg-surface-soft border border-border rounded-xl p-5 flex items-center justify-between hover:border-border/80 transition-colors"
      >
        <div class="flex items-center gap-5">
          <!-- Barcode preview -->
          <div
            class="w-32 h-16 bg-white border border-border rounded-lg flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="label.barcodeImg"
              :src="label.barcodeImg"
              alt="barcode"
              class="max-w-full max-h-full object-contain"
            />
            <span v-else class="text-[10px] text-text-muted">Generating…</span>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-text-primary">{{ label.name }}</h3>
            <p class="text-xs font-mono text-text-muted mt-0.5">{{ label.barcode }}</p>
            <p v-if="label.notes" class="text-xs text-text-muted mt-1">{{ label.notes }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-[11px] text-text-muted">
            {{ new Date(label.created_at).toLocaleDateString() }}
          </span>
          <button
            class="px-3 py-1.5 text-xs font-semibold text-accent border border-accent/30 hover:bg-accent/10 rounded-lg transition-colors"
          >
            Print
          </button>
          <button
            class="px-2 py-1.5 text-xs text-text-muted hover:text-red-400 transition-colors"
            @click="deleteLabel(label.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- Create Label Modal -->
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCreate = false"
    >
      <div
        class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4"
      >
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Create Label</h2>
          <p class="text-xs text-text-muted mt-1">
            Generate a barcode for an item that doesn't have one
          </p>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Name *</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Storage Bin #12"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">
              Barcode Value
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.barcode"
                type="text"
                class="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
              <button
                class="px-3 py-2 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors shrink-0"
                @click="form.barcode = generateBarcodeValue()"
              >
                Regenerate
              </button>
            </div>
            <p class="text-[11px] text-text-muted mt-1">
              Auto-generated — edit if you need a specific value
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">
              Notes (optional)
            </label>
            <input
              v-model="form.notes"
              type="text"
              placeholder="e.g. For shelf labeling"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <p v-if="formError" class="text-xs text-red-400">{{ formError }}</p>
        </div>
        <div class="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
            @click="showCreate = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50"
            :disabled="creating"
            @click="saveLabel"
          >
            {{ creating ? 'Creating…' : 'Create Label' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
