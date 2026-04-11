import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Items
  listItems: (): Promise<unknown[]> => ipcRenderer.invoke('items:list'),
  getItem: (id: number): Promise<unknown> => ipcRenderer.invoke('items:get', id),
  getItemByBarcode: (barcode: string): Promise<unknown> =>
    ipcRenderer.invoke('items:get-by-barcode', barcode),
  createItem: (data: {
    name: string
    make: string
    model: string
    barcode: string
    category: string
    serial_number: string
    quantity: number
    location: string
    retail_value: number
  }): Promise<unknown> => ipcRenderer.invoke('items:create', data),
  updateItem: (
    id: number,
    data: {
      name: string
      make: string
      model: string
      barcode: string
      category: string
      serial_number: string
      quantity: number
      location: string
      retail_value: number
    }
  ): Promise<unknown> => ipcRenderer.invoke('items:update', id, data),
  updateQuantity: (id: number, quantity: number): Promise<unknown> =>
    ipcRenderer.invoke('items:update-quantity', id, quantity),
  deleteItem: (id: number): Promise<void> => ipcRenderer.invoke('items:delete', id),

  // Locations
  listLocations: (): Promise<unknown[]> => ipcRenderer.invoke('locations:list'),
  getLocation: (id: number): Promise<unknown> => ipcRenderer.invoke('locations:get', id),
  createLocation: (data: { name: string; type: string; description: string }): Promise<unknown> =>
    ipcRenderer.invoke('locations:create', data),
  updateLocation: (
    id: number,
    data: { name: string; type: string; description: string }
  ): Promise<unknown> => ipcRenderer.invoke('locations:update', id, data),
  deleteLocation: (id: number): Promise<void> => ipcRenderer.invoke('locations:delete', id),

  // Activity
  listActivity: (limit?: number): Promise<unknown[]> => ipcRenderer.invoke('activity:list', limit),

  // Labels
  listLabels: (): Promise<unknown[]> => ipcRenderer.invoke('labels:list'),
  getLabel: (id: number): Promise<unknown> => ipcRenderer.invoke('labels:get', id),
  createLabel: (data: { name: string; barcode: string; notes: string }): Promise<unknown> =>
    ipcRenderer.invoke('labels:create', data),
  updateLabel: (
    id: number,
    data: { name: string; barcode: string; notes: string }
  ): Promise<unknown> => ipcRenderer.invoke('labels:update', id, data),
  deleteLabel: (id: number): Promise<void> => ipcRenderer.invoke('labels:delete', id),

  // Barcode
  generateBarcode: (text: string, opts?: { scale?: number }): Promise<string> =>
    ipcRenderer.invoke('barcode:generate', text, opts),

  // Data
  exportCsv: (): Promise<string> => ipcRenderer.invoke('data:export-csv'),
  importCsv: (csv: string): Promise<{ imported: number }> =>
    ipcRenderer.invoke('data:import-csv', csv),
  resetDatabase: (): Promise<void> => ipcRenderer.invoke('data:reset'),

  // Check-In / Check-Out
  createCheckout: (data: {
    item_id: number
    checked_out_to: string
    checked_out_by: string
    department: string
    notes: string
    due_date: string | null
    condition_out: string
  }): Promise<unknown> => ipcRenderer.invoke('checkouts:create', data),
  checkinCheckout: (
    checkoutId: number,
    data: { checked_in_by: string; condition_in: string }
  ): Promise<unknown> => ipcRenderer.invoke('checkouts:checkin', checkoutId, data),
  listCheckouts: (itemId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('checkouts:list', itemId),
  listActiveCheckouts: (itemId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('checkouts:active', itemId),
  getActiveCheckoutCount: (): Promise<number> => ipcRenderer.invoke('checkouts:active-count'),

  // Settings
  getSetting: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:get-all'),
  setTheme: (theme: 'system' | 'dark' | 'light'): Promise<void> =>
    ipcRenderer.invoke('theme:set', theme),
  getTheme: (): Promise<string> => ipcRenderer.invoke('theme:get'),
  selectStoragePath: (): Promise<string | null> => ipcRenderer.invoke('storage-path:select'),

  // Item Files
  pickItemImage: (itemId: number): Promise<string | null> =>
    ipcRenderer.invoke('item-files:pick-image', itemId),
  pickItemDocs: (itemId: number): Promise<string[]> =>
    ipcRenderer.invoke('item-files:pick-doc', itemId),
  listItemImages: (itemId: number): Promise<string[]> =>
    ipcRenderer.invoke('item-files:list-images', itemId),
  listItemDocs: (itemId: number): Promise<Array<{ path: string; name: string; size: number }>> =>
    ipcRenderer.invoke('item-files:list-docs', itemId),
  deleteItemFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('item-files:delete', filePath),
  openItemFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('item-files:open', filePath),
  getFileThumbnail: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('item-files:thumbnail', filePath),

  // Printing
  getPrinters: (): Promise<Electron.PrinterInfo[]> => ipcRenderer.invoke('print:get-printers'),
  printLabel: (data: {
    name: string
    barcode: string
    labelSize: string
    printerName: string
  }): Promise<boolean> => ipcRenderer.invoke('print:label', data),

  // Soft Delete / Trash
  softDeleteItem: (id: number): Promise<void> => ipcRenderer.invoke('items:soft-delete', id),
  restoreItem: (id: number): Promise<void> => ipcRenderer.invoke('items:restore', id),
  listTrash: (): Promise<unknown[]> => ipcRenderer.invoke('items:list-trash'),
  emptyTrash: (): Promise<void> => ipcRenderer.invoke('items:empty-trash'),

  // Bulk Operations
  bulkDeleteItems: (ids: number[]): Promise<void> => ipcRenderer.invoke('items:bulk-delete', ids),
  bulkMoveItems: (ids: number[], location: string): Promise<void> =>
    ipcRenderer.invoke('items:bulk-move', ids, location),

  // Item History
  getActivityByBarcode: (barcode: string): Promise<unknown[]> =>
    ipcRenderer.invoke('activity:by-barcode', barcode),

  // Categories
  listCategories: (): Promise<unknown[]> => ipcRenderer.invoke('categories:list'),
  createCategory: (data: { name: string; color: string }): Promise<unknown> =>
    ipcRenderer.invoke('categories:create', data),
  updateCategory: (id: number, data: { name: string; color: string }): Promise<unknown> =>
    ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id: number): Promise<void> => ipcRenderer.invoke('categories:delete', id),

  // Custom Fields
  listCustomFields: (): Promise<unknown[]> => ipcRenderer.invoke('custom-fields:list'),
  createCustomField: (data: {
    name: string
    field_type: string
    options: string
  }): Promise<unknown> => ipcRenderer.invoke('custom-fields:create', data),
  deleteCustomField: (id: number): Promise<void> => ipcRenderer.invoke('custom-fields:delete', id),
  getCustomFieldValues: (itemId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('custom-fields:get-values', itemId),
  setCustomFieldValue: (itemId: number, fieldId: number, value: string): Promise<void> =>
    ipcRenderer.invoke('custom-fields:set-value', itemId, fieldId, value),

  // Overdue Checkouts
  getOverdueCheckouts: (): Promise<unknown[]> => ipcRenderer.invoke('checkouts:overdue'),
  getOverdueCount: (): Promise<number> => ipcRenderer.invoke('checkouts:overdue-count'),

  // Checkout Stats
  getCheckoutStats: (): Promise<unknown> => ipcRenderer.invoke('checkouts:stats'),

  // Dashboard Stats
  getDashboardStats: (): Promise<unknown> => ipcRenderer.invoke('dashboard:stats'),

  // QR Code
  generateQrCode: (text: string, opts?: { scale?: number }): Promise<string> =>
    ipcRenderer.invoke('barcode:generate-qr', text, opts),

  // Remote Database
  testRemoteDb: (config: {
    host: string
    port: number
    database: string
    user: string
    password: string
  }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('remote-db:test', config),
  saveRemoteDb: (config: {
    host: string
    port: number
    database: string
    user: string
    password: string
  }): Promise<void> => ipcRenderer.invoke('remote-db:save', config),
  disconnectRemoteDb: (): Promise<void> => ipcRenderer.invoke('remote-db:disconnect'),
  getDbMode: (): Promise<string> => ipcRenderer.invoke('remote-db:get-mode'),
  getRemoteDbConfig: (): Promise<{
    host: string
    port: number
    database: string
    user: string
    password: string
  } | null> => ipcRenderer.invoke('remote-db:get-config')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
