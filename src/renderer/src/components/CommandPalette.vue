<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

const emit = defineEmits<{
  (e: 'navigate', view: string): void
}>()

const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface Command {
  id: string
  label: string
  section: string
  detail?: string
  shortcut?: string
  action: () => void
}

interface SearchItem {
  id: number
  name: string
  barcode: string
  category: string
  location: string
}

const commands: Command[] = [
  {
    id: 'nav-dashboard',
    label: 'Go to Dashboard',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('dashboard')
  },
  {
    id: 'nav-scan',
    label: 'Go to Scan',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('scan')
  },
  {
    id: 'nav-items',
    label: 'Go to Items',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('items')
  },
  {
    id: 'nav-locations',
    label: 'Go to Locations',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('locations')
  },
  {
    id: 'nav-labels',
    label: 'Go to Barcodes',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('labels')
  },
  {
    id: 'nav-activity',
    label: 'Go to Activity Log',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('activity')
  },
  {
    id: 'nav-categories',
    label: 'Go to Categories',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('categories')
  },
  {
    id: 'nav-trash',
    label: 'Go to Trash',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('trash')
  },
  {
    id: 'nav-settings',
    label: 'Go to Settings',
    section: 'Navigation',
    shortcut: '',
    action: () => nav('settings')
  },
  {
    id: 'action-new-item',
    label: 'Create New Item',
    section: 'Actions',
    shortcut: '',
    action: () => nav('items')
  },
  {
    id: 'action-export',
    label: 'Export Inventory (CSV)',
    section: 'Actions',
    shortcut: '',
    action: () => nav('settings')
  },
  {
    id: 'action-import',
    label: 'Import Inventory (CSV)',
    section: 'Actions',
    shortcut: '',
    action: () => nav('settings')
  }
]

const inventoryItems = ref<SearchItem[]>([])
let itemsLoaded = false

async function loadItems(): Promise<void> {
  if (itemsLoaded) return
  inventoryItems.value = (await window.api.listItems()) as SearchItem[]
  itemsLoaded = true
}

const inventoryResults = computed(() => {
  const q = query.value.toLowerCase()
  if (!q || q.length < 2) return []
  return inventoryItems.value
    .filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map((i) => ({
      id: `item-${i.id}`,
      label: i.name,
      section: 'Items',
      detail: [i.barcode, i.category, i.location].filter(Boolean).join(' · '),
      action: () => nav('items')
    }))
})

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  const cmds = q
    ? commands.filter(
        (c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)
      )
    : commands
  const inv = inventoryResults.value
  return [...cmds, ...inv]
})

watch(filtered, () => {
  selectedIndex.value = 0
})

function nav(view: string): void {
  emit('navigate', view)
  close()
}

function close(): void {
  open.value = false
  query.value = ''
  selectedIndex.value = 0
}

function execute(cmd: Command): void {
  cmd.action()
  close()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    open.value = !open.value
    if (open.value) {
      loadItems()
      nextTick(() => inputRef.value?.focus())
    }
    return
  }

  if (!open.value) return

  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = filtered.value[selectedIndex.value]
    if (cmd) execute(cmd)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-100 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <!-- Input -->
        <div class="flex items-center gap-3 px-4 border-b border-border">
          <span class="text-text-muted text-sm">⌘</span>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Type a command…"
            class="flex-1 bg-transparent py-4 text-sm text-text-primary placeholder-text-muted outline-none"
          />
          <kbd
            class="text-[10px] text-text-muted bg-surface-mute px-1.5 py-0.5 rounded border border-border"
            >ESC</kbd
          >
        </div>

        <!-- Results -->
        <div class="max-h-72 overflow-y-auto py-2">
          <template v-if="filtered.length">
            <div
              v-for="(cmd, i) in filtered"
              :key="cmd.id"
              class="flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors"
              :class="
                i === selectedIndex
                  ? 'bg-surface-mute text-text-primary'
                  : 'text-text-secondary hover:bg-surface-mute/50'
              "
              @click="execute(cmd)"
              @mouseenter="selectedIndex = i"
            >
              <div class="flex items-center gap-3">
                <span class="text-[11px] text-text-muted uppercase tracking-wide w-16">{{
                  cmd.section === 'Navigation' ? 'Nav' : cmd.section === 'Items' ? 'Item' : 'Action'
                }}</span>
                <div>
                  <span class="text-sm">{{ cmd.label }}</span>
                  <p v-if="cmd.detail" class="text-[11px] text-text-muted">{{ cmd.detail }}</p>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="py-8 text-center">
            <p class="text-sm text-text-muted">No results found</p>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-4 py-2.5 border-t border-border flex items-center gap-4 text-[11px] text-text-muted"
        >
          <span
            ><kbd class="px-1 py-0.5 bg-surface-mute rounded border border-border">↑↓</kbd>
            Navigate</span
          >
          <span
            ><kbd class="px-1 py-0.5 bg-surface-mute rounded border border-border">⏎</kbd>
            Execute</span
          >
          <span
            ><kbd class="px-1 py-0.5 bg-surface-mute rounded border border-border">Esc</kbd>
            Close</span
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>
