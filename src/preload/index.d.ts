import { ElectronAPI } from '@electron-toolkit/preload'

interface AtlyxItem {
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
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface AtlyxLocation {
  id: number
  name: string
  type: string
  description: string
  parent_id: number | null
  itemCount: number
  created_at: string
}

interface AtlyxActivity {
  id: number
  type: 'scan' | 'create' | 'update' | 'delete' | 'print'
  item_name: string
  barcode: string
  detail: string
  timestamp: string
}

interface AtlyxLabel {
  id: number
  name: string
  barcode: string
  notes: string
  created_at: string
}

interface AtlyxCheckout {
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

interface AtlyxOverdueCheckout extends AtlyxCheckout {
  item_name: string
  item_barcode: string
}

interface AtlyxCategory {
  id: number
  name: string
  color: string
  itemCount: number
  created_at: string
}

interface AtlyxCustomField {
  id: number
  name: string
  field_type: 'text' | 'number' | 'date' | 'select'
  options: string
  created_at: string
}

interface AtlyxCustomFieldValue {
  field_id: number
  value: string
  name: string
  field_type: string
}

interface AtlyxCheckoutStats {
  activeCount: number
  overdueCount: number
  topCheckedOut: Array<{ name: string; cnt: number }>
  topUsers: Array<{ name: string; cnt: number }>
  avgDurationDays: number
}

interface AtlyxDashboardStats {
  totalItems: number
  totalUnits: number
  totalValue: number
  categoryBreakdown: Array<{ name: string; count: number }>
}

interface AtlyxAPI {
  listItems(): Promise<AtlyxItem[]>
  getItem(id: number): Promise<AtlyxItem | null>
  getItemByBarcode(barcode: string): Promise<AtlyxItem | null>
  createItem(data: {
    name: string
    make: string
    model: string
    barcode: string
    category: string
    serial_number: string
    quantity: number
    location: string
    retail_value: number
  }): Promise<AtlyxItem>
  updateItem(
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
  ): Promise<AtlyxItem | null>
  updateQuantity(id: number, quantity: number): Promise<AtlyxItem | null>
  deleteItem(id: number): Promise<void>

  // Soft Delete / Trash
  softDeleteItem(id: number): Promise<void>
  restoreItem(id: number): Promise<void>
  listTrash(): Promise<AtlyxItem[]>
  emptyTrash(): Promise<void>

  // Bulk Operations
  bulkDeleteItems(ids: number[]): Promise<void>
  bulkMoveItems(ids: number[], location: string): Promise<void>

  // Item History
  getActivityByBarcode(barcode: string): Promise<AtlyxActivity[]>

  // Locations
  listLocations(): Promise<AtlyxLocation[]>
  getLocation(id: number): Promise<AtlyxLocation | null>
  createLocation(data: { name: string; type: string; description: string }): Promise<AtlyxLocation>
  updateLocation(
    id: number,
    data: { name: string; type: string; description: string }
  ): Promise<AtlyxLocation | null>
  deleteLocation(id: number): Promise<void>

  // Activity
  listActivity(limit?: number): Promise<AtlyxActivity[]>

  // Labels
  listLabels(): Promise<AtlyxLabel[]>
  getLabel(id: number): Promise<AtlyxLabel | null>
  createLabel(data: { name: string; barcode: string; notes: string }): Promise<AtlyxLabel>
  updateLabel(
    id: number,
    data: { name: string; barcode: string; notes: string }
  ): Promise<AtlyxLabel | null>
  deleteLabel(id: number): Promise<void>

  // Barcodes & QR
  generateBarcode(text: string, opts?: { scale?: number }): Promise<string>
  generateQrCode(text: string, opts?: { scale?: number }): Promise<string>

  // Data
  exportCsv(): Promise<string>
  importCsv(csv: string): Promise<{ imported: number }>
  resetDatabase(): Promise<void>

  // Checkouts
  createCheckout(data: {
    item_id: number
    checked_out_to: string
    checked_out_by: string
    department: string
    notes: string
    due_date: string | null
    condition_out: string
  }): Promise<AtlyxCheckout>
  checkinCheckout(
    checkoutId: number,
    data: { checked_in_by: string; condition_in: string }
  ): Promise<AtlyxCheckout>
  listCheckouts(itemId: number): Promise<AtlyxCheckout[]>
  listActiveCheckouts(itemId: number): Promise<AtlyxCheckout[]>
  getActiveCheckoutCount(): Promise<number>
  getOverdueCheckouts(): Promise<AtlyxOverdueCheckout[]>
  getOverdueCount(): Promise<number>
  getCheckoutStats(): Promise<AtlyxCheckoutStats>

  // Categories
  listCategories(): Promise<AtlyxCategory[]>
  createCategory(data: { name: string; color: string }): Promise<AtlyxCategory>
  updateCategory(id: number, data: { name: string; color: string }): Promise<AtlyxCategory | null>
  deleteCategory(id: number): Promise<void>

  // Custom Fields
  listCustomFields(): Promise<AtlyxCustomField[]>
  createCustomField(data: {
    name: string
    field_type: string
    options: string
  }): Promise<AtlyxCustomField>
  deleteCustomField(id: number): Promise<void>
  getCustomFieldValues(itemId: number): Promise<AtlyxCustomFieldValue[]>
  setCustomFieldValue(itemId: number, fieldId: number, value: string): Promise<void>

  // Dashboard
  getDashboardStats(): Promise<AtlyxDashboardStats>

  // Settings
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  getAllSettings(): Promise<Record<string, string>>
  setTheme(theme: 'system' | 'dark' | 'light'): Promise<void>
  getTheme(): Promise<string>
  selectStoragePath(): Promise<string | null>

  // Item Files
  pickItemImage(itemId: number): Promise<string | null>
  pickItemDocs(itemId: number): Promise<string[]>
  listItemImages(itemId: number): Promise<string[]>
  listItemDocs(itemId: number): Promise<Array<{ path: string; name: string; size: number }>>
  deleteItemFile(filePath: string): Promise<void>
  openItemFile(filePath: string): Promise<void>
  getFileThumbnail(filePath: string): Promise<string | null>

  // Printing
  getPrinters(): Promise<Array<{ name: string; isDefault: boolean }>>
  printLabel(data: {
    name: string
    barcode: string
    labelSize: string
    printerName: string
  }): Promise<boolean>

  // Remote Database
  testRemoteDb(config: {
    engine: 'mysql' | 'mariadb' | 'postgres'
    host: string
    port: number
    database: string
    user: string
    password: string
  }): Promise<{ ok: boolean; error?: string }>
  saveRemoteDb(config: {
    engine: 'mysql' | 'mariadb' | 'postgres'
    host: string
    port: number
    database: string
    user: string
    password: string
  }): Promise<void>
  disconnectRemoteDb(): Promise<void>
  getDbMode(): Promise<string>
  getRemoteDbConfig(): Promise<{
    engine: 'mysql' | 'mariadb' | 'postgres'
    host: string
    port: number
    database: string
    user: string
    password: string
  } | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AtlyxAPI
  }
}
