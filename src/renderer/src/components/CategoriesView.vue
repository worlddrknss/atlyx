<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Category {
  id: number
  name: string
  color: string
  itemCount: number
  created_at: string
}

const categories = ref<Category[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingCategory = ref<Category | null>(null)
const form = ref({ name: '', color: '#6366f1' })

const presetColors = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#64748b'
]

onMounted(async () => {
  categories.value = (await window.api.listCategories()) as Category[]
})

async function createCategory(): Promise<void> {
  if (!form.value.name.trim()) return
  const created = (await window.api.createCategory({
    name: form.value.name.trim(),
    color: form.value.color
  })) as Category
  categories.value.push({ ...created, itemCount: 0 })
  showCreateModal.value = false
  form.value = { name: '', color: '#6366f1' }
}

function openEditModal(cat: Category): void {
  editingCategory.value = cat
  form.value = { name: cat.name, color: cat.color }
  showEditModal.value = true
}

async function updateCategory(): Promise<void> {
  if (!editingCategory.value || !form.value.name.trim()) return
  const updated = (await window.api.updateCategory(editingCategory.value.id, {
    name: form.value.name.trim(),
    color: form.value.color
  })) as Category | null
  if (updated) {
    const idx = categories.value.findIndex((c) => c.id === editingCategory.value!.id)
    if (idx !== -1) {
      categories.value[idx] = { ...updated, itemCount: categories.value[idx].itemCount }
    }
  }
  showEditModal.value = false
  editingCategory.value = null
  form.value = { name: '', color: '#6366f1' }
}

async function deleteCategory(cat: Category): Promise<void> {
  await window.api.deleteCategory(cat.id)
  categories.value = categories.value.filter((c) => c.id !== cat.id)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-bold text-text-primary">Categories</h2>
        <p class="text-xs text-text-muted mt-0.5">{{ categories.length }} categories</p>
      </div>
      <button
        class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
        @click="showCreateModal = true"
      >
        + Add Category
      </button>
    </div>

    <!-- Category Cards -->
    <div class="grid grid-cols-3 gap-4">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="bg-surface-soft border border-border rounded-xl p-5 hover:border-border/80 transition-colors group"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <span class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
            <div>
              <h3
                class="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors"
              >
                {{ cat.name }}
              </h3>
              <p class="text-xs text-text-muted mt-0.5">{{ cat.itemCount }} items</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
              title="Edit category"
              @click="openEditModal(cat)"
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
              title="Delete category"
              @click="deleteCategory(cat)"
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
      </div>
    </div>

    <div v-if="!categories.length" class="py-12 text-center">
      <p class="text-sm text-text-muted">
        No categories yet. Create one to organize your inventory.
      </p>
    </div>

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCreateModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">New Category</h2>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Electronics"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="c in presetColors"
                :key="c"
                class="w-7 h-7 rounded-full border-2 transition-colors"
                :class="form.color === c ? 'border-white' : 'border-transparent'"
                :style="{ backgroundColor: c }"
                @click="form.color = c"
              />
            </div>
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
            @click="createCategory"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showEditModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Edit Category</h2>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Electronics"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="c in presetColors"
                :key="c"
                class="w-7 h-7 rounded-full border-2 transition-colors"
                :class="form.color === c ? 'border-white' : 'border-transparent'"
                :style="{ backgroundColor: c }"
                @click="form.color = c"
              />
            </div>
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
            @click="updateCategory"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
