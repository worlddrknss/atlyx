<script setup lang="ts">
import { ref } from 'vue'

const settings = ref({
  appName: 'Atlyx',
  autoFocusScan: true,
  soundOnScan: true,
  theme: 'system',
  labelSize: 'small',
  printerName: 'DYMO LabelWriter 450'
})

const themes = ['system', 'dark', 'light']
const labelSizes = ['small', 'medium', 'large']

const exportStatus = ref('')
const importStatus = ref('')
const resetConfirm = ref(false)

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
              @click="settings.theme = t"
            >
              {{ t }}
            </button>
          </div>
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
            @click="settings.soundOnScan = !settings.soundOnScan"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="settings.soundOnScan ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>
    </section>

    <!-- Printing -->
    <section class="mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">Printing</h3>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Printer</p>
            <p class="text-xs text-text-muted mt-0.5">{{ settings.printerName }}</p>
          </div>
          <button
            class="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:border-accent/50 rounded-lg transition-colors"
          >
            Select
          </button>
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
              @click="settings.labelSize = s"
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
