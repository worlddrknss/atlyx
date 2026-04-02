import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Items
  listItems: (): Promise<unknown[]> => ipcRenderer.invoke('items:list'),
  getItemByBarcode: (barcode: string): Promise<unknown> => ipcRenderer.invoke('items:get-by-barcode', barcode),
  createItem: (data: { name: string; barcode: string; category: string; quantity: number; location: string }): Promise<unknown> =>
    ipcRenderer.invoke('items:create', data),
  updateQuantity: (id: number, quantity: number): Promise<unknown> =>
    ipcRenderer.invoke('items:update-quantity', id, quantity),
  deleteItem: (id: number): Promise<void> => ipcRenderer.invoke('items:delete', id),

  // Locations
  listLocations: (): Promise<unknown[]> => ipcRenderer.invoke('locations:list'),
  createLocation: (data: { name: string; type: string; description: string }): Promise<unknown> =>
    ipcRenderer.invoke('locations:create', data),

  // Activity
  listActivity: (limit?: number): Promise<unknown[]> => ipcRenderer.invoke('activity:list', limit),

  // Labels
  listLabels: (): Promise<unknown[]> => ipcRenderer.invoke('labels:list'),
  createLabel: (data: { name: string; barcode: string; notes: string }): Promise<unknown> =>
    ipcRenderer.invoke('labels:create', data),
  deleteLabel: (id: number): Promise<void> => ipcRenderer.invoke('labels:delete', id),

  // Barcode
  generateBarcode: (text: string, opts?: { scale?: number }): Promise<string> =>
    ipcRenderer.invoke('barcode:generate', text, opts),

  // Data
  exportCsv: (): Promise<string> => ipcRenderer.invoke('data:export-csv'),
  importCsv: (csv: string): Promise<{ imported: number }> => ipcRenderer.invoke('data:import-csv', csv),
  resetDatabase: (): Promise<void> => ipcRenderer.invoke('data:reset')
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
