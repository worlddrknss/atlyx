<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Location {
  id: number
  name: string
  type: string
  itemCount: number
  description: string
  parent_id: number | null
}

const locations = ref<Location[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingLocation = ref<Location | null>(null)
const form = ref({ name: '', type: 'Warehouse', description: '', parent_id: null as number | null })
const locationTypes = ['Warehouse', 'Office', 'Shelf', 'Vehicle', 'Other']

// Build hierarchical view
const rootLocations = computed(() => locations.value.filter((l) => !l.parent_id))
const childrenOf = computed(() => {
  const map: Record<number, Location[]> = {}
  for (const l of locations.value) {
    if (l.parent_id) {
      if (!map[l.parent_id]) map[l.parent_id] = []
      map[l.parent_id].push(l)
    }
  }
  return map
})

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
  locations.value.push({ ...created, itemCount: 0, parent_id: form.value.parent_id } as Location)
  showCreateModal.value = false
  form.value = { name: '', type: 'Warehouse', description: '', parent_id: null }
}

function openEditModal(loc: Location): void {
  editingLocation.value = loc
  form.value = {
    name: loc.name,
    type: loc.type,
    description: loc.description,
    parent_id: loc.parent_id
  }
  showEditModal.value = true
}

async function updateLocation(): Promise<void> {
  if (!editingLocation.value || !form.value.name.trim()) return
  const updated = (await window.api.updateLocation(editingLocation.value.id, {
    name: form.value.name.trim(),
    type: form.value.type,
    description: form.value.description.trim()
  })) as Location | null
  if (updated) {
    const idx = locations.value.findIndex((l) => l.id === editingLocation.value!.id)
    if (idx !== -1) locations.value[idx] = { ...updated, parent_id: form.value.parent_id }
  }
  showEditModal.value = false
  editingLocation.value = null
  form.value = { name: '', type: 'Warehouse', description: '', parent_id: null }
}

async function deleteLocation(loc: Location): Promise<void> {
  await window.api.deleteLocation(loc.id)
  locations.value = locations.value.filter((l) => l.id !== loc.id)
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
            <label class="block text-xs font-medium text-text-secondary mb-1.5"
              >Parent Location</label
            >
            <select
              v-model="form.parent_id"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option :value="null">None (Top Level)</option>
              <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
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
      <template v-for="loc in rootLocations" :key="loc.id">
        <div
          class="bg-surface-soft border border-border rounded-xl p-5 hover:border-border/80 transition-colors group"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3
                class="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors"
              >
                {{ loc.name }}
              </h3>
              <p class="text-xs text-text-muted mt-1">{{ loc.description }}</p>
            </div>
            <div class="flex items-center gap-1">
              <span
                class="text-[11px] font-semibold px-2 py-0.5 rounded-md mr-1"
                :class="typeColor(loc.type)"
              >
                {{ loc.type }}
              </span>
              <button
                class="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                title="Edit location"
                @click="openEditModal(loc)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828zM4 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4l-2 2v2H4V6h2l2-2H4z"
                  />
                </svg>
              </button>
              <button
                class="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Delete location"
                @click="deleteLocation(loc)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <span class="text-xl font-bold text-text-primary tabular-nums">{{
                loc.itemCount
              }}</span>
              <span class="text-[11px] text-text-muted uppercase tracking-wide">items</span>
            </div>
          </div>

          <!-- Children -->
          <div v-if="childrenOf[loc.id]?.length" class="mt-3 space-y-2 border-t border-border pt-3">
            <div
              v-for="child in childrenOf[loc.id]"
              :key="child.id"
              class="flex items-center justify-between pl-3 border-l-2 border-accent/30"
            >
              <div>
                <p class="text-sm text-text-secondary">{{ child.name }}</p>
                <p class="text-[11px] text-text-muted">{{ child.itemCount }} items</p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="p-1 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  @click="openEditModal(child)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3 h-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828zM4 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4l-2 2v2H4V6h2l2-2H4z"
                    />
                  </svg>
                </button>
                <button
                  class="p-1 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  @click="deleteLocation(child)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3 h-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Edit Location Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showEditModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Edit Location</h2>
          <p class="text-xs text-text-muted mt-1">Update location details</p>
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
            @click="showEditModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            @click="updateLocation"
          >
            Update Location
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
