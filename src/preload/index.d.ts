import { ElectronAPI } from '@electron-toolkit/preload'

interface AtlyxItem {
  id: number
  name: string
  barcode: string
  category: string
  quantity: number
  location: string
  created_at: string
  updated_at: string
}

interface AtlyxLocation {
  id: number
  name: string
  type: string
  description: string
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

interface AtlyxAPI {
  listItems(): Promise<AtlyxItem[]>
  getItemByBarcode(barcode: string): Promise<AtlyxItem | null>
  createItem(data: { name: string; barcode: string; category: string; quantity: number; location: string }): Promise<AtlyxItem>
  updateQuantity(id: number, quantity: number): Promise<AtlyxItem | null>
  deleteItem(id: number): Promise<void>
  listLocations(): Promise<AtlyxLocation[]>
  createLocation(data: { name: string; type: string; description: string }): Promise<AtlyxLocation>
  listActivity(limit?: number): Promise<AtlyxActivity[]>
  listLabels(): Promise<AtlyxLabel[]>
  createLabel(data: { name: string; barcode: string; notes: string }): Promise<AtlyxLabel>
  deleteLabel(id: number): Promise<void>
  generateBarcode(text: string, opts?: { scale?: number }): Promise<string>
  exportCsv(): Promise<string>
  importCsv(csv: string): Promise<{ imported: number }>
  resetDatabase(): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AtlyxAPI
  }
}
