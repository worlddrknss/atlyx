<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  barcode: string
}>()

interface CustomFieldDef {
  id: number
  name: string
  field_type: string
  options: string | null
}

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'save',
    item: {
      name: string
      make: string
      model: string
      barcode: string
      category: string
      serial_number: string
      quantity: number
      location: string
      retail_value: number
    },
    customFieldValues: Record<number, string>
  ): void
}>()

const name = ref('')
const make = ref('')
const model = ref('')
const category = ref('')
const serialNumber = ref('')
const quantity = ref(1)
const location = ref('')
const retailValue = ref(0)

const categories = ref<string[]>([])
const locations = ref<string[]>([])
const customFields = ref<CustomFieldDef[]>([])
const customFieldFormValues = ref<Record<number, string>>({})

onMounted(async () => {
  const [cats, locs, cfDefs] = await Promise.all([
    window.api.listCategories(),
    window.api.listLocations(),
    window.api.listCustomFields()
  ])
  categories.value = cats.map((c: { name: string }) => c.name)
  locations.value = locs.map((l: { name: string }) => l.name)
  customFields.value = cfDefs as CustomFieldDef[]
})

function handleSave(): void {
  if (!name.value.trim()) return
  emit(
    'save',
    {
      name: name.value.trim(),
      make: make.value.trim(),
      model: model.value.trim(),
      barcode: props.barcode,
      category: category.value.trim(),
      serial_number: serialNumber.value.trim(),
      quantity: quantity.value,
      location: location.value.trim(),
      retail_value: retailValue.value
    },
    { ...customFieldFormValues.value }
  )
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
      <div class="px-6 py-5 border-b border-border">
        <h2 class="text-base font-semibold text-text-primary">Create New Item</h2>
        <p class="text-xs text-text-muted mt-1">Item not found — add it to inventory</p>
      </div>

      <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
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

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Make</label>
            <input
              v-model="make"
              type="text"
              placeholder="e.g. Logitech"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Model</label>
            <input
              v-model="model"
              type="text"
              placeholder="e.g. MX Master 3"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
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
            <label class="block text-xs font-medium text-text-secondary mb-1.5">SN / Tag</label>
            <input
              v-model="serialNumber"
              type="text"
              placeholder="Serial number"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
            <select
              v-model="category"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option value="">No category</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Location</label>
            <select
              v-model="location"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option value="">No location</option>
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Quantity</label>
            <input
              v-model.number="quantity"
              type="number"
              min="0"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5"
              >Retail Value ($)</label
            >
            <input
              v-model.number="retailValue"
              type="number"
              min="0"
              step="0.01"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
        </div>

        <!-- Custom Fields -->
        <div v-if="customFields.length" class="border-t border-border pt-4 mt-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Custom Fields
          </p>
          <div class="space-y-3">
            <div v-for="cf in customFields" :key="cf.id">
              <label class="block text-xs font-medium text-text-secondary mb-1.5">{{
                cf.name
              }}</label>
              <select
                v-if="cf.field_type === 'select' && cf.options"
                :value="customFieldFormValues[cf.id] ?? ''"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                @change="customFieldFormValues[cf.id] = ($event.target as HTMLSelectElement).value"
              >
                <option value="">—</option>
                <option v-for="opt in cf.options.split(',')" :key="opt" :value="opt.trim()">
                  {{ opt.trim() }}
                </option>
              </select>
              <input
                v-else
                :type="
                  cf.field_type === 'number' ? 'number' : cf.field_type === 'date' ? 'date' : 'text'
                "
                :value="customFieldFormValues[cf.id] ?? ''"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                @input="customFieldFormValues[cf.id] = ($event.target as HTMLInputElement).value"
              />
            </div>
          </div>
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
