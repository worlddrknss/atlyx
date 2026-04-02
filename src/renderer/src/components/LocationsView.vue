<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Location {
  id: number
  name: string
  type: string
  itemCount: number
  description: string
}

const locations = ref<Location[]>([])
const showCreateModal = ref(false)
const form = ref({ name: '', type: 'Warehouse', description: '' })
const locationTypes = ['Warehouse', 'Office', 'Shelf', 'Vehicle', 'Other']

onMounted(async () => {
  locations.value = (await window.api.listLocations()) as Location[]
})

async function createLocation(): Promise<void> {
  if (!form.value.name.trim()) return
  const created = await window.api.createLocation({
    name: form.value.name.trim(),
    type: form.value.type,
    description: form.value.description.trim()
  })
  locations.value.push({ ...created, itemCount: 0 } as Location)
  showCreateModal.value = false
  form.value = { name: '', type: 'Warehouse', description: '' }
}

function typeColor(type: string): string {
  if (type === 'Warehouse') return 'text-blue-400 bg-blue-400/10'
  if (type === 'Office') return 'text-purple-400 bg-purple-400/10'
  return 'text-amber-400 bg-amber-400/10'
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">Locations</h2>
        <p class="text-xs text-text-muted mt-0.5">{{ locations.length }} locations configured</p>
      </div>
      <button
        class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
        @click="showCreateModal = true"
      >
        + Add Location
      </button>
    </div>

    <!-- Create Location Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCreateModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Add New Location</h2>
          <p class="text-xs text-text-muted mt-1">Create a storage location</p>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Warehouse C"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
            <select
              v-model="form.type"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option v-for="t in locationTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
            <textarea
              v-model="form.description"
              placeholder="Optional description…"
              rows="2"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors resize-none"
            />
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
            @click="createLocation"
          >
            Save Location
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div
        v-for="loc in locations"
        :key="loc.id"
        class="bg-surface-soft border border-border rounded-xl p-5 hover:border-border/80 transition-colors cursor-pointer group"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">{{ loc.name }}</h3>
            <p class="text-xs text-text-muted mt-1">{{ loc.description }}</p>
          </div>
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md" :class="typeColor(loc.type)">
            {{ loc.type }}
          </span>
        </div>
        <div class="mt-4 flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span class="text-xl font-bold text-text-primary tabular-nums">{{ loc.itemCount }}</span>
            <span class="text-[11px] text-text-muted uppercase tracking-wide">items</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
