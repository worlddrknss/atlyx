<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface InventoryItem {
  id: number
  name: string
  make: string
  model: string
  barcode: string
  category: string
  serial_number: string
  quantity: number
  min_quantity: number
  location: string
  retail_value: number
  deleted_at: string | null
}

const search = ref('')
const items = ref<InventoryItem[]>([])
const locations = ref<string[]>([])
const categories = ref<string[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingItem = ref<InventoryItem | null>(null)
const showDetailModal = ref(false)
const detailItem = ref<InventoryItem | null>(null)
const detailTab = ref<'details' | 'documents' | 'checkouts' | 'history'>('details')
const detailImages = ref<string[]>([])
const detailDocs = ref<Array<{ path: string; name: string; size: number }>>([])
const docThumbnails = ref<Record<string, string>>({})

// Bulk selection
const selectedIds = ref<Set<number>>(new Set())
const showBulkMoveModal = ref(false)
const bulkMoveTarget = ref('')

// Item history
const itemHistory = ref<
  Array<{
    id: number
    type: string
    item_name: string
    barcode: string
    detail: string
    timestamp: string
  }>
>([])

interface Checkout {
  id: number
  item_id: number
  checked_out_to: string
  checked_out_by: string
  department: string
  notes: string
  due_date: string | null
  checked_out_at: string
  checked_in_at: string | null
  checked_in_by: string | null
  condition_out: string
  condition_in: string | null
}

const detailCheckouts = ref<Checkout[]>([])
const showCheckoutForm = ref(false)
const showCheckinModal = ref(false)
const checkinTarget = ref<Checkout | null>(null)
const conditions = ['New', 'Good', 'Fair', 'Poor', 'Damaged']
const checkoutForm = ref({
  checked_out_to: '',
  checked_out_by: '',
  department: '',
  notes: '',
  due_date: '',
  condition_out: 'Good'
})
const checkinForm = ref({
  checked_in_by: '',
  condition_in: 'Good'
})
const form = ref({
  name: '',
  make: '',
  model: '',
  barcode: '',
  category: '',
  serial_number: '',
  quantity: 1,
  location: '',
  retail_value: 0
})

// Custom field values for detail view
interface CustomFieldValue {
  field_id: number
  value: string
  name: string
  field_type: string
}
const detailCustomFields = ref<CustomFieldValue[]>([])

// Custom fields definitions + form values for create/edit
interface CustomFieldDef {
  id: number
  name: string
  field_type: string
  options: string | null
}
const customFields = ref<CustomFieldDef[]>([])
const customFieldFormValues = ref<Record<number, string>>({})

onMounted(async () => {
  const [itemList, locs, cats, cfDefs] = await Promise.all([
    window.api.listItems(),
    window.api.listLocations(),
    window.api.listCategories(),
    window.api.listCustomFields()
  ])
  items.value = itemList as InventoryItem[]
  locations.value = locs.map((l) => l.name)
  categories.value = cats.map((c) => c.name)
  customFields.value = cfDefs as CustomFieldDef[]
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
    make: form.value.make.trim(),
    model: form.value.model.trim(),
    barcode: form.value.barcode.trim(),
    category: form.value.category.trim(),
    serial_number: form.value.serial_number.trim(),
    quantity: form.value.quantity,
    location: form.value.location,
    retail_value: form.value.retail_value
  })) as InventoryItem
  // Save custom field values
  for (const [fieldId, val] of Object.entries(customFieldFormValues.value)) {
    if (val) await window.api.setCustomFieldValue(created.id, Number(fieldId), val)
  }
  items.value.push(created)
  showCreateModal.value = false
  form.value = {
    name: '',
    make: '',
    model: '',
    barcode: '',
    category: '',
    serial_number: '',
    quantity: 1,
    location: '',
    retail_value: 0
  }
  customFieldFormValues.value = {}
}

async function openEditModal(item: InventoryItem): Promise<void> {
  editingItem.value = item
  form.value = {
    name: item.name,
    make: item.make,
    model: item.model,
    barcode: item.barcode,
    category: item.category,
    serial_number: item.serial_number,
    quantity: item.quantity,
    location: item.location,
    retail_value: item.retail_value
  }
  // Load existing custom field values for this item
  const cfVals = (await window.api.getCustomFieldValues(item.id)) as CustomFieldValue[]
  const vals: Record<number, string> = {}
  for (const v of cfVals) vals[v.field_id] = v.value
  customFieldFormValues.value = vals
  showEditModal.value = true
}

async function updateItem(): Promise<void> {
  if (!editingItem.value || !form.value.name.trim() || !form.value.barcode.trim()) return
  const updated = (await window.api.updateItem(editingItem.value.id, {
    name: form.value.name.trim(),
    make: form.value.make.trim(),
    model: form.value.model.trim(),
    barcode: form.value.barcode.trim(),
    category: form.value.category.trim(),
    serial_number: form.value.serial_number.trim(),
    quantity: form.value.quantity,
    location: form.value.location,
    retail_value: form.value.retail_value
  })) as InventoryItem | null
  // Save custom field values
  for (const [fieldId, val] of Object.entries(customFieldFormValues.value)) {
    await window.api.setCustomFieldValue(editingItem.value.id, Number(fieldId), val ?? '')
  }
  if (updated) {
    const idx = items.value.findIndex((i) => i.id === editingItem.value!.id)
    if (idx !== -1) items.value[idx] = updated
  }
  showEditModal.value = false
  editingItem.value = null
  form.value = {
    name: '',
    make: '',
    model: '',
    barcode: '',
    category: '',
    serial_number: '',
    quantity: 1,
    location: '',
    retail_value: 0
  }
  customFieldFormValues.value = {}
}

async function deleteItem(item: InventoryItem): Promise<void> {
  await window.api.softDeleteItem(item.id)
  items.value = items.value.filter((i) => i.id !== item.id)
}

// Bulk actions
const allSelected = computed(
  () =>
    filteredItems.value.length > 0 && filteredItems.value.every((i) => selectedIds.value.has(i.id))
)

function toggleSelectAll(): void {
  if (allSelected.value) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(filteredItems.value.map((i) => i.id))
  }
}

function toggleSelect(id: number): void {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

function clearSelectedItems(): void {
  selectedIds.value.clear()
  selectedIds.value = new Set()
}

async function bulkDelete(): Promise<void> {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return
  await window.api.bulkDeleteItems(ids)
  items.value = items.value.filter((i) => !selectedIds.value.has(i.id))
  selectedIds.value.clear()
}

async function bulkMove(): Promise<void> {
  const ids = Array.from(selectedIds.value)
  if (!ids.length || !bulkMoveTarget.value) return
  await window.api.bulkMoveItems(ids, bulkMoveTarget.value)
  for (const item of items.value) {
    if (selectedIds.value.has(item.id)) {
      item.location = bulkMoveTarget.value
    }
  }
  selectedIds.value.clear()
  showBulkMoveModal.value = false
  bulkMoveTarget.value = ''
}

async function openDetailModal(item: InventoryItem): Promise<void> {
  detailItem.value = item
  detailTab.value = 'details'
  showDetailModal.value = true
  showCheckoutForm.value = false
  const [imgs, docs, checkouts, history, cfValues] = await Promise.all([
    window.api.listItemImages(item.id),
    window.api.listItemDocs(item.id),
    window.api.listCheckouts(item.id),
    window.api.getActivityByBarcode(item.barcode),
    window.api.getCustomFieldValues(item.id)
  ])
  detailImages.value = imgs
  detailDocs.value = docs
  loadDocThumbnails()
  detailCheckouts.value = checkouts as Checkout[]
  itemHistory.value = history
  detailCustomFields.value = cfValues as CustomFieldValue[]
}

function fileUrl(path: string): string {
  return 'atlyx-file://' + encodeURIComponent(path)
}

const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return imageExts.has(ext)
}

function docExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}

async function loadDocThumbnails(): Promise<void> {
  docThumbnails.value = {}
  const nonImageDocs = detailDocs.value.filter((d) => !isImageFile(d.name))
  const results = await Promise.all(
    nonImageDocs.map(async (doc) => {
      const thumb = await window.api.getFileThumbnail(doc.path)
      return { path: doc.path, thumb }
    })
  )
  const map: Record<string, string> = {}
  for (const r of results) {
    if (r.thumb) map[r.path] = r.thumb
  }
  docThumbnails.value = map
}

async function pickDetailImage(): Promise<void> {
  if (!detailItem.value) return
  const path = await window.api.pickItemImage(detailItem.value.id)
  if (path) detailImages.value = await window.api.listItemImages(detailItem.value.id)
}

async function pickDetailDocs(): Promise<void> {
  if (!detailItem.value) return
  const saved = await window.api.pickItemDocs(detailItem.value.id)
  if (saved.length) {
    detailDocs.value = await window.api.listItemDocs(detailItem.value.id)
    loadDocThumbnails()
  }
}

async function removeDetailFile(filePath: string, type: 'image' | 'doc'): Promise<void> {
  if (!detailItem.value) return
  await window.api.deleteItemFile(filePath)
  if (type === 'image') {
    detailImages.value = await window.api.listItemImages(detailItem.value.id)
  } else {
    detailDocs.value = await window.api.listItemDocs(detailItem.value.id)
  }
}

function openFile(filePath: string): void {
  window.api.openItemFile(filePath)
}

async function submitCheckout(): Promise<void> {
  if (!detailItem.value || !checkoutForm.value.checked_out_to.trim()) return
  await window.api.createCheckout({
    item_id: detailItem.value.id,
    checked_out_to: checkoutForm.value.checked_out_to.trim(),
    checked_out_by: checkoutForm.value.checked_out_by.trim(),
    department: checkoutForm.value.department.trim(),
    notes: checkoutForm.value.notes.trim(),
    due_date: checkoutForm.value.due_date || null,
    condition_out: checkoutForm.value.condition_out
  })
  // Refresh item (quantity changed) and checkouts
  const refreshed = (await window.api.getItem(detailItem.value.id)) as InventoryItem | null
  if (refreshed) {
    detailItem.value = refreshed
    const idx = items.value.findIndex((i) => i.id === refreshed.id)
    if (idx !== -1) items.value[idx] = refreshed
  }
  detailCheckouts.value = (await window.api.listCheckouts(detailItem.value.id)) as Checkout[]
  showCheckoutForm.value = false
  checkoutForm.value = {
    checked_out_to: '',
    checked_out_by: '',
    department: '',
    notes: '',
    due_date: '',
    condition_out: 'Good'
  }
}

function openCheckinModal(checkout: Checkout): void {
  checkinTarget.value = checkout
  checkinForm.value = { checked_in_by: '', condition_in: checkout.condition_out }
  showCheckinModal.value = true
}

async function submitCheckin(): Promise<void> {
  if (!checkinTarget.value || !detailItem.value) return
  await window.api.checkinCheckout(checkinTarget.value.id, {
    checked_in_by: checkinForm.value.checked_in_by.trim(),
    condition_in: checkinForm.value.condition_in
  })
  const refreshed = (await window.api.getItem(detailItem.value.id)) as InventoryItem | null
  if (refreshed) {
    detailItem.value = refreshed
    const idx = items.value.findIndex((i) => i.id === refreshed.id)
    if (idx !== -1) items.value[idx] = refreshed
  }
  detailCheckouts.value = (await window.api.listCheckouts(detailItem.value.id)) as Checkout[]
  showCheckinModal.value = false
  checkinTarget.value = null
}

function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso + 'Z').toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isOverdue(checkout: Checkout): boolean {
  if (!checkout.due_date || checkout.checked_in_at) return false
  return new Date(checkout.due_date) < new Date()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
        <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Item Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Wireless Mouse"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Make</label>
              <input
                v-model="form.make"
                type="text"
                placeholder="e.g. Logitech"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Model</label>
              <input
                v-model="form.model"
                type="text"
                placeholder="e.g. MX Master 3S"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Barcode</label>
              <input
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 4901234567890"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">SN / Tag</label>
              <input
                v-model="form.serial_number"
                type="text"
                placeholder="e.g. SN-20260401-001"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
              <select
                v-model="form.category"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              >
                <option value="">No category</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
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
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Quantity</label>
              <input
                v-model.number="form.quantity"
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
                v-model.number="form.retail_value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
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
                  @change="
                    customFieldFormValues[cf.id] = ($event.target as HTMLSelectElement).value
                  "
                >
                  <option value="">—</option>
                  <option v-for="opt in cf.options.split(',')" :key="opt" :value="opt.trim()">
                    {{ opt.trim() }}
                  </option>
                </select>
                <input
                  v-else
                  :type="
                    cf.field_type === 'number'
                      ? 'number'
                      : cf.field_type === 'date'
                        ? 'date'
                        : 'text'
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

    <!-- Edit Item Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showEditModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Edit Item</h2>
          <p class="text-xs text-text-muted mt-1">Update item details</p>
        </div>
        <div class="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Item Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Wireless Mouse"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Make</label>
              <input
                v-model="form.make"
                type="text"
                placeholder="e.g. Logitech"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Model</label>
              <input
                v-model="form.model"
                type="text"
                placeholder="e.g. MX Master 3S"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Barcode</label>
              <input
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 4901234567890"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">SN / Tag</label>
              <input
                v-model="form.serial_number"
                type="text"
                placeholder="e.g. SN-20260401-001"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors font-mono"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
              <select
                v-model="form.category"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              >
                <option value="">No category</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
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
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Quantity</label>
              <input
                v-model.number="form.quantity"
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
                v-model.number="form.retail_value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
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
                  @change="
                    customFieldFormValues[cf.id] = ($event.target as HTMLSelectElement).value
                  "
                >
                  <option value="">—</option>
                  <option v-for="opt in cf.options.split(',')" :key="opt" :value="opt.trim()">
                    {{ opt.trim() }}
                  </option>
                </select>
                <input
                  v-else
                  :type="
                    cf.field_type === 'number'
                      ? 'number'
                      : cf.field_type === 'date'
                        ? 'date'
                        : 'text'
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
            @click="showEditModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            @click="updateItem"
          >
            Update Item
          </button>
        </div>
      </div>
    </div>

    <!-- Item Detail Modal -->
    <div
      v-if="showDetailModal && detailItem"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showDetailModal = false"
    >
      <div
        class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-text-primary">{{ detailItem.name }}</h2>
            <p class="text-xs text-text-muted mt-0.5 font-mono">{{ detailItem.barcode }}</p>
          </div>
          <button
            class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-mute transition-colors"
            @click="showDetailModal = false"
          >
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-border px-6">
          <button
            class="px-4 py-2.5 text-xs font-medium transition-colors relative"
            :class="
              detailTab === 'details' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
            "
            @click="detailTab = 'details'"
          >
            Details
            <span
              v-if="detailTab === 'details'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
            />
          </button>
          <button
            class="px-4 py-2.5 text-xs font-medium transition-colors relative"
            :class="
              detailTab === 'documents'
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary'
            "
            @click="detailTab = 'documents'"
          >
            Documents
            <span
              v-if="detailImages.length || detailDocs.length"
              class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-mute"
            >
              {{ detailImages.length + detailDocs.length }}
            </span>
            <span
              v-if="detailTab === 'documents'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
            />
          </button>
          <button
            class="px-4 py-2.5 text-xs font-medium transition-colors relative"
            :class="
              detailTab === 'checkouts'
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary'
            "
            @click="detailTab = 'checkouts'"
          >
            Check-In / Out
            <span
              v-if="detailCheckouts.some((c) => !c.checked_in_at)"
              class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400"
            >
              {{ detailCheckouts.filter((c) => !c.checked_in_at).length }}
            </span>
            <span
              v-if="detailTab === 'checkouts'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
            />
          </button>
          <button
            class="px-4 py-2.5 text-xs font-medium transition-colors relative"
            :class="
              detailTab === 'history' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
            "
            @click="detailTab = 'history'"
          >
            History
            <span
              v-if="itemHistory.length"
              class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-mute"
            >
              {{ itemHistory.length }}
            </span>
            <span
              v-if="detailTab === 'history'"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
            />
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- ═══ Details Tab ═══ -->
          <div v-if="detailTab === 'details'" class="space-y-6">
            <div class="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">Make</p>
                <p class="text-sm text-text-primary mt-0.5">{{ detailItem.make || '—' }}</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  Model
                </p>
                <p class="text-sm text-text-primary mt-0.5">{{ detailItem.model || '—' }}</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  Category
                </p>
                <p class="text-sm text-text-primary mt-0.5">{{ detailItem.category || '—' }}</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  Location
                </p>
                <p class="text-sm text-text-primary mt-0.5">{{ detailItem.location || '—' }}</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  SN / Tag
                </p>
                <p class="text-sm text-text-primary mt-0.5 font-mono">
                  {{ detailItem.serial_number || '—' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  Retail Value
                </p>
                <p class="text-sm text-text-primary mt-0.5">
                  {{ detailItem.retail_value ? '$' + detailItem.retail_value.toFixed(2) : '—' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                  Quantity
                </p>
                <p class="text-sm text-text-primary mt-0.5">
                  {{ detailItem.quantity }}
                  <span
                    class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md"
                    :class="statusColor(deriveStatus(detailItem.quantity))"
                  >
                    {{ deriveStatus(detailItem.quantity) }}
                  </span>
                </p>
              </div>
            </div>

            <!-- Custom Fields -->
            <div v-if="detailCustomFields.length">
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                Custom Fields
              </p>
              <div class="grid grid-cols-2 gap-x-8 gap-y-3">
                <div v-for="cf in detailCustomFields" :key="cf.field_id">
                  <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                    {{ cf.name }}
                  </p>
                  <p class="text-sm text-text-primary mt-0.5">{{ cf.value || '—' }}</p>
                </div>
              </div>
            </div>

            <!-- Item Image (on details tab) -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Item Image
                </p>
                <button
                  class="px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 rounded-md transition-colors"
                  @click="pickDetailImage"
                >
                  + Add Image
                </button>
              </div>
              <div v-if="detailImages.length" class="flex flex-wrap gap-3">
                <div
                  v-for="img in detailImages"
                  :key="img"
                  class="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-surface"
                >
                  <img :src="fileUrl(img)" class="w-full h-full object-cover" />
                  <button
                    class="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="removeDetailFile(img, 'image')"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-text-muted italic">No images attached</p>
            </div>
          </div>

          <!-- ═══ Documents Tab ═══ -->
          <div v-if="detailTab === 'documents'" class="space-y-6">
            <!-- Images Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">Images</p>
                <button
                  class="px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 rounded-md transition-colors"
                  @click="pickDetailImage"
                >
                  + Add Image
                </button>
              </div>
              <div v-if="detailImages.length" class="flex flex-wrap gap-3">
                <div
                  v-for="img in detailImages"
                  :key="img"
                  class="relative group w-28 h-28 rounded-lg overflow-hidden border border-border bg-surface"
                >
                  <img :src="fileUrl(img)" class="w-full h-full object-cover" />
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                  >
                    <button
                      class="p-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
                      title="Open"
                      @click="openFile(img)"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fill-rule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      class="p-1 rounded bg-red-500/60 text-white hover:bg-red-500/80 transition-colors"
                      title="Remove"
                      @click="removeDetailFile(img, 'image')"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-text-muted italic">No images attached</p>
            </div>

            <!-- Files Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Files &amp; Documentation
                </p>
                <button
                  class="px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 rounded-md transition-colors"
                  @click="pickDetailDocs"
                >
                  + Attach File
                </button>
              </div>
              <div v-if="detailDocs.length" class="flex flex-wrap gap-3">
                <div
                  v-for="doc in detailDocs"
                  :key="doc.path"
                  class="relative group w-28 rounded-lg overflow-hidden border border-border bg-surface"
                >
                  <!-- Thumbnail area -->
                  <div class="w-full h-28 flex items-center justify-center bg-surface-alt">
                    <img
                      v-if="isImageFile(doc.name)"
                      :src="fileUrl(doc.path)"
                      class="w-full h-full object-cover"
                    />
                    <img
                      v-else-if="docThumbnails[doc.path]"
                      :src="docThumbnails[doc.path]"
                      class="w-full h-full object-cover"
                    />
                    <span
                      v-else
                      class="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-accent/15 text-accent"
                    >
                      {{ docExt(doc.name) }}
                    </span>
                  </div>
                  <!-- Name + size -->
                  <div class="px-2 py-1.5 min-w-0">
                    <p class="text-[11px] truncate" :title="doc.name">{{ doc.name }}</p>
                    <p class="text-[10px] text-text-muted">{{ formatFileSize(doc.size) }}</p>
                  </div>
                  <!-- Hover overlay with Open / Remove -->
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                  >
                    <button
                      class="p-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
                      title="Open"
                      @click="openFile(doc.path)"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fill-rule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      class="p-1 rounded bg-red-500/60 text-white hover:bg-red-500/80 transition-colors"
                      title="Remove"
                      @click="removeDetailFile(doc.path, 'doc')"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-text-muted italic">No files attached</p>
            </div>
          </div>

          <!-- ═══ Check-In / Check-Out Tab ═══ -->
          <div v-if="detailTab === 'checkouts'" class="space-y-5">
            <!-- Action header -->
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Asset Tracking
              </p>
              <button
                v-if="!showCheckoutForm"
                class="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
                @click="showCheckoutForm = true"
              >
                + Check Out
              </button>
            </div>

            <!-- Checkout Form -->
            <div
              v-if="showCheckoutForm"
              class="bg-surface border border-border rounded-xl p-4 space-y-3"
            >
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1"
                    >Assigned To *</label
                  >
                  <input
                    v-model="checkoutForm.checked_out_to"
                    type="text"
                    placeholder="Person or team name"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1"
                    >Checked Out By</label
                  >
                  <input
                    v-model="checkoutForm.checked_out_by"
                    type="text"
                    placeholder="Your name"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1"
                    >Department</label
                  >
                  <input
                    v-model="checkoutForm.department"
                    type="text"
                    placeholder="e.g. Engineering"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1">Due Date</label>
                  <input
                    v-model="checkoutForm.due_date"
                    type="date"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1"
                    >Condition</label
                  >
                  <select
                    v-model="checkoutForm.condition_out"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  >
                    <option v-for="c in conditions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1">Notes</label>
                  <input
                    v-model="checkoutForm.notes"
                    type="text"
                    placeholder="Optional notes"
                    class="w-full bg-surface-soft border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
                  />
                </div>
              </div>
              <div class="flex items-center justify-end gap-2 pt-1">
                <button
                  class="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
                  @click="showCheckoutForm = false"
                >
                  Cancel
                </button>
                <button
                  class="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
                  :disabled="!checkoutForm.checked_out_to.trim()"
                  @click="submitCheckout"
                >
                  Check Out Item
                </button>
              </div>
            </div>

            <!-- Active Checkouts -->
            <div v-if="detailCheckouts.some((c) => !c.checked_in_at)">
              <p class="text-[11px] uppercase tracking-wider text-amber-400 font-medium mb-2">
                Currently Checked Out
              </p>
              <div class="space-y-2">
                <div
                  v-for="co in detailCheckouts.filter((c) => !c.checked_in_at)"
                  :key="co.id"
                  class="bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3"
                >
                  <div class="flex items-start justify-between">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-text-primary">
                        {{ co.checked_out_to }}
                        <span v-if="co.department" class="text-text-muted font-normal"
                          >· {{ co.department }}</span
                        >
                      </p>
                      <p class="text-xs text-text-muted mt-0.5">
                        Out: {{ formatDateTime(co.checked_out_at) }}
                        <span v-if="co.checked_out_by"> · by {{ co.checked_out_by }}</span>
                      </p>
                      <p
                        v-if="co.due_date"
                        class="text-xs mt-0.5"
                        :class="isOverdue(co) ? 'text-red-400 font-semibold' : 'text-text-muted'"
                      >
                        Due: {{ formatDate(co.due_date) }}
                        <span v-if="isOverdue(co)"> — OVERDUE</span>
                      </p>
                      <p v-if="co.notes" class="text-xs text-text-muted mt-0.5 italic">
                        {{ co.notes }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 ml-3">
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded border"
                        :class="{
                          'text-emerald-400 border-emerald-400/20 bg-emerald-400/5':
                            co.condition_out === 'New' || co.condition_out === 'Good',
                          'text-amber-400 border-amber-400/20 bg-amber-400/5':
                            co.condition_out === 'Fair',
                          'text-red-400 border-red-400/20 bg-red-400/5':
                            co.condition_out === 'Poor' || co.condition_out === 'Damaged'
                        }"
                      >
                        {{ co.condition_out }}
                      </span>
                      <button
                        class="px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 rounded-md transition-colors"
                        @click="openCheckinModal(co)"
                      >
                        Check In
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- History -->
            <div v-if="detailCheckouts.some((c) => c.checked_in_at)">
              <p class="text-[11px] uppercase tracking-wider text-text-muted font-medium mb-2">
                History
              </p>
              <div class="space-y-1.5">
                <div
                  v-for="co in detailCheckouts.filter((c) => c.checked_in_at)"
                  :key="co.id"
                  class="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-xs"
                >
                  <div class="min-w-0">
                    <span class="text-text-primary font-medium">{{ co.checked_out_to }}</span>
                    <span v-if="co.department" class="text-text-muted"> · {{ co.department }}</span>
                  </div>
                  <div class="flex items-center gap-3 shrink-0 ml-3 text-text-muted">
                    <span
                      >{{ formatDate(co.checked_out_at) }} →
                      {{ formatDate(co.checked_in_at!) }}</span
                    >
                    <span
                      v-if="co.condition_out !== co.condition_in"
                      class="text-amber-400"
                      :title="co.condition_out + ' → ' + co.condition_in"
                    >
                      ⚠
                    </span>
                    <span v-else class="text-emerald-400">✓</span>
                  </div>
                </div>
              </div>
            </div>

            <p
              v-if="detailCheckouts.length === 0 && !showCheckoutForm"
              class="text-xs text-text-muted italic"
            >
              No checkout history
            </p>
          </div>

          <!-- ═══ History Tab ═══ -->
          <div v-if="detailTab === 'history'" class="space-y-1">
            <p v-if="!itemHistory.length" class="text-xs text-text-muted italic">
              No activity recorded
            </p>
            <div
              v-for="evt in itemHistory"
              :key="evt.id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-mute/30 transition-colors"
            >
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                :class="{
                  'bg-emerald-400/10 text-emerald-400': evt.type === 'create',
                  'bg-blue-400/10 text-blue-400': evt.type === 'update',
                  'bg-amber-400/10 text-amber-400': evt.type === 'scan',
                  'bg-red-400/10 text-red-400': evt.type === 'delete',
                  'bg-purple-400/10 text-purple-400': evt.type === 'print'
                }"
              >
                {{
                  evt.type === 'create'
                    ? '+'
                    : evt.type === 'update'
                      ? '✎'
                      : evt.type === 'scan'
                        ? '⎋'
                        : evt.type === 'delete'
                          ? '✕'
                          : '⎙'
                }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-text-primary capitalize">{{ evt.type }}</p>
                <p class="text-xs text-text-muted truncate">{{ evt.detail || '—' }}</p>
              </div>
              <span class="text-[11px] text-text-muted shrink-0">{{
                formatDateTime(evt.timestamp)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Check-In Modal -->
    <div
      v-if="showCheckinModal && checkinTarget"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCheckinModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Check In Item</h2>
          <p class="text-xs text-text-muted mt-1">
            Returning from {{ checkinTarget.checked_out_to }}
          </p>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5"
              >Checked In By</label
            >
            <input
              v-model="checkinForm.checked_in_by"
              type="text"
              placeholder="Your name"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5"
              >Return Condition</label
            >
            <select
              v-model="checkinForm.condition_in"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option v-for="c in conditions" :key="c" :value="c">{{ c }}</option>
            </select>
            <p
              v-if="checkinForm.condition_in !== checkinTarget.condition_out"
              class="text-xs text-amber-400 mt-1"
            >
              Condition changed from "{{ checkinTarget.condition_out }}" to "{{
                checkinForm.condition_in
              }}"
            </p>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
            @click="showCheckinModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
            @click="submitCheckin"
          >
            Confirm Check In
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Move Modal -->
    <div
      v-if="showBulkMoveModal"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showBulkMoveModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">
            Move {{ selectedIds.size }} Items
          </h2>
        </div>
        <div class="px-6 py-5">
          <label class="block text-xs font-medium text-text-secondary mb-1.5"
            >Target Location</label
          >
          <select
            v-model="bulkMoveTarget"
            class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
          >
            <option value="">Select location…</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
            @click="showBulkMoveModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            :disabled="!bulkMoveTarget"
            @click="bulkMove"
          >
            Move Items
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Actions Bar -->
    <div
      v-if="selectedIds.size > 0"
      class="mb-4 flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3"
    >
      <span class="text-sm font-medium text-accent">{{ selectedIds.size }} selected</span>
      <div class="flex-1" />
      <button
        class="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
        @click="showBulkMoveModal = true"
      >
        Move
      </button>
      <button
        class="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 rounded-lg transition-colors"
        @click="bulkDelete"
      >
        Delete
      </button>
      <button
        class="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
        @click="clearSelectedItems"
      >
        Clear
      </button>
    </div>

    <!-- Table -->
    <div class="bg-surface-soft border border-border rounded-xl overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="w-10 px-4 py-3">
              <input
                type="checkbox"
                class="rounded accent-accent"
                :checked="allSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Name
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Make / Model
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Barcode
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              SN / Tag
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
              class="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Value
            </th>
            <th
              class="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-text-muted font-medium"
            >
              Status
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
            v-for="item in filteredItems"
            :key="item.id"
            class="border-b border-border/50 hover:bg-surface-mute/40 transition-colors cursor-pointer"
            @click="openDetailModal(item)"
          >
            <td class="w-10 px-4 py-3" @click.stop>
              <input
                type="checkbox"
                class="rounded accent-accent"
                :checked="selectedIds.has(item.id)"
                @change="toggleSelect(item.id)"
              />
            </td>
            <td class="px-4 py-3 text-sm text-text-primary font-medium">
              {{ item.name }}
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">
              {{ [item.make, item.model].filter(Boolean).join(' ') || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary font-mono">{{ item.barcode }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary font-mono">
              {{ item.serial_number }}
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ item.location }}</td>
            <td class="px-4 py-3 text-sm text-text-primary text-right tabular-nums">
              {{ item.quantity }}
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary text-right tabular-nums">
              {{ item.retail_value ? '$' + item.retail_value.toFixed(2) : '—' }}
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs font-semibold px-2.5 py-1 rounded-md"
                :class="statusColor(deriveStatus(item.quantity))"
              >
                {{ deriveStatus(item.quantity) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  class="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  title="Edit item"
                  @click.stop="openEditModal(item)"
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
                  title="Delete item"
                  @click.stop="deleteItem(item)"
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
