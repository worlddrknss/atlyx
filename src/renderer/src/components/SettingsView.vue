<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface CustomField {
  id: number
  name: string
  field_type: string
  options: string
}

const settings = ref({
  appName: 'Atlyx',
  autoFocusScan: true,
  soundOnScan: true,
  barcodeFormat: 'code128',
  theme: 'system',
  labelSize: 'small',
  printerName: 'DYMO LabelWriter 450',
  storagePath: ''
})

const themes = ['system', 'dark', 'light'] as const
const labelSizes = ['small', 'medium', 'large']
const barcodeFormats = [
  { value: 'code128', label: 'Code 128' },
  { value: 'qrcode', label: 'QR Code' }
]

const exportStatus = ref('')
const importStatus = ref('')
const resetConfirm = ref(false)

// Custom fields
const customFields = ref<CustomField[]>([])
const showFieldModal = ref(false)
const fieldForm = ref({ name: '', field_type: 'text', options: '' })
const fieldTypes = ['text', 'number', 'date', 'select']

const dbMode = ref<'local' | 'remote'>('local')
const remoteDb = ref({
  host: '',
  port: 5432,
  database: '',
  user: '',
  password: ''
})
const dbTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const dbTestError = ref('')
const printers = ref<Array<{ name: string; isDefault: boolean }>>([])
const showPrinterDropdown = ref(false)

onMounted(async () => {
  settings.value.theme = await window.api.getTheme()
  const sp = await window.api.getSetting('storagePath')
  settings.value.storagePath = sp ?? ''
  const sound = await window.api.getSetting('soundOnScan')
  if (sound !== null) settings.value.soundOnScan = sound === 'true'
  const savedPrinter = await window.api.getSetting('printerName')
  if (savedPrinter) settings.value.printerName = savedPrinter
  const savedLabelSize = await window.api.getSetting('labelSize')
  if (savedLabelSize) settings.value.labelSize = savedLabelSize
  const savedFormat = await window.api.getSetting('barcodeFormat')
  if (savedFormat) settings.value.barcodeFormat = savedFormat

  const mode = await window.api.getDbMode()
  dbMode.value = mode === 'remote' ? 'remote' : 'local'
  const config = await window.api.getRemoteDbConfig()
  if (config) {
    remoteDb.value = config
  }

  customFields.value = (await window.api.listCustomFields()) as CustomField[]
})

async function setTheme(t: 'system' | 'dark' | 'light'): Promise<void> {
  settings.value.theme = t
  await window.api.setTheme(t)
}

async function selectStoragePath(): Promise<void> {
  const path = await window.api.selectStoragePath()
  if (path) settings.value.storagePath = path
}

async function toggleSound(): Promise<void> {
  settings.value.soundOnScan = !settings.value.soundOnScan
  await window.api.setSetting('soundOnScan', String(settings.value.soundOnScan))
}

async function selectPrinter(): Promise<void> {
  printers.value = await window.api.getPrinters()
  showPrinterDropdown.value = true
}

async function setPrinter(name: string): Promise<void> {
  settings.value.printerName = name
  showPrinterDropdown.value = false
  await window.api.setSetting('printerName', name)
}

async function setLabelSize(size: string): Promise<void> {
  settings.value.labelSize = size
  await window.api.setSetting('labelSize', size)
}

async function setBarcodeFormat(fmt: string): Promise<void> {
  settings.value.barcodeFormat = fmt
  await window.api.setSetting('barcodeFormat', fmt)
}

async function createCustomField(): Promise<void> {
  if (!fieldForm.value.name.trim()) return
  const created = (await window.api.createCustomField({
    name: fieldForm.value.name.trim(),
    field_type: fieldForm.value.field_type,
    options: fieldForm.value.options.trim()
  })) as CustomField
  customFields.value.push(created)
  showFieldModal.value = false
  fieldForm.value = { name: '', field_type: 'text', options: '' }
}

async function deleteCustomField(field: CustomField): Promise<void> {
  await window.api.deleteCustomField(field.id)
  customFields.value = customFields.value.filter((f) => f.id !== field.id)
}

async function handleExport(): Promise<void> {
  try {
    exportStatus.value = 'Exporting…'
    const csv = await window.api.exportCsv()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atlyx-inventory-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    exportStatus.value = 'Exported!'
    setTimeout(() => (exportStatus.value = ''), 2000)
  } catch {
    exportStatus.value = 'Export failed'
  }
}

async function handleImport(): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      importStatus.value = 'Importing…'
      const text = await file.text()
      const result = await window.api.importCsv(text)
      importStatus.value = `Imported ${result.imported} items`
      setTimeout(() => (importStatus.value = ''), 3000)
    } catch {
      importStatus.value = 'Import failed'
    }
  }
  input.click()
}

async function handleReset(): Promise<void> {
  if (!resetConfirm.value) {
    resetConfirm.value = true
    setTimeout(() => (resetConfirm.value = false), 3000)
    return
  }
  await window.api.resetDatabase()
  resetConfirm.value = false
}

async function testRemoteDb(): Promise<void> {
  dbTestStatus.value = 'testing'
  dbTestError.value = ''
  const result = await window.api.testRemoteDb(remoteDb.value)
  if (result.ok) {
    dbTestStatus.value = 'success'
  } else {
    dbTestStatus.value = 'error'
    dbTestError.value = result.error ?? 'Connection failed'
  }
}

async function saveRemoteDb(): Promise<void> {
  await window.api.saveRemoteDb(remoteDb.value)
  dbMode.value = 'remote'
}

async function disconnectRemoteDb(): Promise<void> {
  await window.api.disconnectRemoteDb()
  dbMode.value = 'local'
  dbTestStatus.value = 'idle'
  dbTestError.value = ''
}
</script>

<template>
  <div class="p-6 max-w-2xl">
    <h2 class="text-lg font-bold text-text-primary mb-1">Settings</h2>
    <p class="text-xs text-text-muted mb-8">Configure your Atlyx instance</p>

    <!-- General -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">General</h3>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Theme</p>
            <p class="text-xs text-text-muted mt-0.5">Follow system appearance or force a mode</p>
          </div>
          <div
            class="flex items-center bg-surface-soft border border-border rounded-lg overflow-hidden"
          >
            <button
              v-for="t in themes"
              :key="t"
              class="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              :class="
                settings.theme === t
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              "
              @click="setTheme(t)"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Storage Path</p>
            <p class="text-xs text-text-muted mt-0.5">
              {{ settings.storagePath || 'No path configured' }}
            </p>
          </div>
          <button
            class="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
            @click="selectStoragePath"
          >
            Browse
          </button>
        </div>
      </div>
    </section>

    <!-- Scanner -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">Scanner</h3>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Auto-focus scan input</p>
            <p class="text-xs text-text-muted mt-0.5">
              Keep the barcode input focused after each scan
            </p>
          </div>
          <button
            class="relative w-11 h-6 rounded-full transition-colors"
            :class="settings.autoFocusScan ? 'bg-accent' : 'bg-surface-mute border border-border'"
            @click="settings.autoFocusScan = !settings.autoFocusScan"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="settings.autoFocusScan ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Sound on scan</p>
            <p class="text-xs text-text-muted mt-0.5">
              Play a confirmation beep after successful scan
            </p>
          </div>
          <button
            class="relative w-11 h-6 rounded-full transition-colors"
            :class="settings.soundOnScan ? 'bg-accent' : 'bg-surface-mute border border-border'"
            @click="toggleSound"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="settings.soundOnScan ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>
    </section>

    <!-- Barcode Format -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
        Barcode Format
      </h3>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-text-primary">Default barcode type</p>
          <p class="text-xs text-text-muted mt-0.5">
            Code 128 for standard barcodes, QR Code for 2D
          </p>
        </div>
        <div
          class="flex items-center bg-surface-soft border border-border rounded-lg overflow-hidden"
        >
          <button
            v-for="fmt in barcodeFormats"
            :key="fmt.value"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="
              settings.barcodeFormat === fmt.value
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="setBarcodeFormat(fmt.value)"
          >
            {{ fmt.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- Custom Fields -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
        Custom Fields
      </h3>
      <div class="space-y-3">
        <div
          v-for="field in customFields"
          :key="field.id"
          class="flex items-center justify-between bg-surface-soft border border-border rounded-lg px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-text-primary">{{ field.name }}</p>
            <p class="text-xs text-text-muted capitalize">
              {{ field.field_type }}{{ field.options ? ' · ' + field.options : '' }}
            </p>
          </div>
          <button
            class="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            @click="deleteCustomField(field)"
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
        <p v-if="!customFields.length" class="text-xs text-text-muted italic">
          No custom fields defined
        </p>
        <button
          class="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          @click="showFieldModal = true"
        >
          + Add Custom Field
        </button>
      </div>
    </section>

    <!-- Custom Field Modal -->
    <div
      v-if="showFieldModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showFieldModal = false"
    >
      <div class="bg-surface-soft border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 py-5 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Add Custom Field</h2>
          <p class="text-xs text-text-muted mt-1">This field will be available on all items</p>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Field Name</label>
            <input
              v-model="fieldForm.name"
              type="text"
              placeholder="e.g. Purchase Date"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Field Type</label>
            <select
              v-model="fieldForm.field_type"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            >
              <option v-for="ft in fieldTypes" :key="ft" :value="ft">{{ ft }}</option>
            </select>
          </div>
          <div v-if="fieldForm.field_type === 'select'">
            <label class="block text-xs font-medium text-text-secondary mb-1.5"
              >Options (comma-separated)</label
            >
            <input
              v-model="fieldForm.options"
              type="text"
              placeholder="Option A, Option B, Option C"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
        </div>
        <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-mute transition-colors"
            @click="showFieldModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            @click="createCustomField"
          >
            Add Field
          </button>
        </div>
      </div>
    </div>

    <!-- Printing -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">Printing</h3>
      <div class="space-y-5">
        <div class="relative">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-text-primary">Printer</p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ settings.printerName || 'No printer selected' }}
              </p>
            </div>
            <button
              class="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
              @click="selectPrinter"
            >
              Select
            </button>
          </div>
          <div
            v-if="showPrinterDropdown"
            class="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-lg shadow-lg z-10 py-1 max-h-48 overflow-y-auto"
          >
            <button
              v-for="p in printers"
              :key="p.name"
              class="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 transition-colors flex items-center justify-between"
              @click="setPrinter(p.name)"
            >
              <span class="truncate">{{ p.name }}</span>
              <span v-if="p.isDefault" class="text-[10px] text-accent ml-2 shrink-0">Default</span>
            </button>
            <p v-if="!printers.length" class="px-3 py-2 text-xs text-text-muted italic">
              No printers found
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Default label size</p>
            <p class="text-xs text-text-muted mt-0.5">Used when printing from scan view</p>
          </div>
          <div
            class="flex items-center bg-surface-soft border border-border rounded-lg overflow-hidden"
          >
            <button
              v-for="s in labelSizes"
              :key="s"
              class="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              :class="
                settings.labelSize === s
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              "
              @click="setLabelSize(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Data -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">Data</h3>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Export Inventory</p>
            <p class="text-xs text-text-muted mt-0.5">Download all items as a CSV file</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="exportStatus" class="text-xs text-text-muted">{{ exportStatus }}</span>
            <button
              class="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
              @click="handleExport"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Import Inventory</p>
            <p class="text-xs text-text-muted mt-0.5">
              Load items from a CSV file (name, barcode, quantity)
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="importStatus" class="text-xs text-text-muted">{{ importStatus }}</span>
            <button
              class="px-3 py-2 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
              @click="handleImport"
            >
              Import CSV
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Reset Database</p>
            <p class="text-xs text-text-muted mt-0.5">
              Delete all items, locations, and activity history
            </p>
          </div>
          <button
            class="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            :class="
              resetConfirm
                ? 'text-white bg-red-500 hover:bg-red-600'
                : 'text-red-400 border border-red-400/30 hover:bg-red-400/10'
            "
            @click="handleReset"
          >
            {{ resetConfirm ? 'Confirm Reset' : 'Reset' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Database -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">Database</h3>
      <div class="space-y-5">
        <!-- Mode indicator -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Connection Mode</p>
            <p class="text-xs text-text-muted mt-0.5">
              {{
                dbMode === 'remote' ? 'Connected to PostgreSQL database' : 'Using local SQLite database'
              }}
            </p>
          </div>
          <span
            class="px-2.5 py-1 text-xs font-semibold rounded-md"
            :class="
              dbMode === 'remote'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-surface-mute text-text-muted border border-border'
            "
          >
            {{ dbMode === 'remote' ? '● Remote' : '○ Local' }}
          </span>
        </div>

        <!-- Connection fields -->
        <div class="bg-surface-soft border border-border rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-text-secondary mb-1">Host</label>
              <input
                v-model="remoteDb.host"
                type="text"
                placeholder="localhost or 192.168.1.100"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1">Port</label>
              <input
                v-model.number="remoteDb.port"
                type="number"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1">Database</label>
            <input
              v-model="remoteDb.database"
              type="text"
              placeholder="atlyx"
              class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1">Username</label>
              <input
                v-model="remoteDb.user"
                type="text"
                placeholder="root"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1">Password</label>
              <input
                v-model="remoteDb.password"
                type="password"
                placeholder="••••••••"
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
          </div>

          <!-- Status line -->
          <div v-if="dbTestStatus !== 'idle'" class="text-xs mt-1">
            <span v-if="dbTestStatus === 'testing'" class="text-text-muted"
              >Testing connection…</span
            >
            <span v-else-if="dbTestStatus === 'success'" class="text-emerald-400"
              >✓ Connection successful</span
            >
            <span v-else-if="dbTestStatus === 'error'" class="text-red-400"
              >✗ {{ dbTestError }}</span
            >
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              v-if="dbMode === 'remote'"
              class="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 rounded-lg transition-colors"
              @click="disconnectRemoteDb"
            >
              Disconnect
            </button>
            <button
              class="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
              :disabled="!remoteDb.host"
              @click="testRemoteDb"
            >
              Test Connection
            </button>
            <button
              v-if="dbTestStatus === 'success'"
              class="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
              @click="saveRemoteDb"
            >
              Connect &amp; Save
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- About -->
    <section>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">About</h3>
      <div class="bg-surface-soft border border-border rounded-xl p-4">
        <p class="text-sm font-semibold text-text-primary">Atlyx</p>
        <p class="text-xs text-text-muted mt-0.5">
          Version 1.0.0 — Local-first inventory management
        </p>
        <p class="text-xs text-text-muted mt-2">Electron + Vue 3 + TypeScript</p>
      </div>
    </section>
  </div>
</template>
