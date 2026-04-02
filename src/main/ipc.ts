import { ipcMain } from 'electron'
import { getDatabase } from './database'
import bwipjs from 'bwip-js'

export function registerIpcHandlers(): void {
  const db = getDatabase()

  // ── Items ──────────────────────────────────────────────────

  ipcMain.handle('items:list', () => {
    return db.prepare('SELECT * FROM items ORDER BY name').all()
  })

  ipcMain.handle('items:get-by-barcode', (_e, barcode: string) => {
    return db.prepare('SELECT * FROM items WHERE barcode = ?').get(barcode) ?? null
  })

  ipcMain.handle(
    'items:create',
    (_e, data: { name: string; barcode: string; category: string; quantity: number; location: string }) => {
      const stmt = db.prepare(
        'INSERT INTO items (name, barcode, category, quantity, location) VALUES (?, ?, ?, ?, ?)'
      )
      const result = stmt.run(data.name, data.barcode, data.category, data.quantity, data.location)

      logActivity('create', data.name, data.barcode, `New item created, qty: ${data.quantity}`)

      return db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle('items:update-quantity', (_e, id: number, quantity: number) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
      | { name: string; barcode: string; quantity: number }
      | undefined
    if (!item) return null

    db.prepare("UPDATE items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
      quantity,
      id
    )

    logActivity('update', item.name, item.barcode, `Quantity changed: ${item.quantity} → ${quantity}`)

    return db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  })

  ipcMain.handle('items:delete', (_e, id: number) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
      | { name: string; barcode: string }
      | undefined
    if (item) {
      logActivity('delete', item.name, item.barcode, 'Item removed from inventory')
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(id)
  })

  // ── Locations ──────────────────────────────────────────────

  ipcMain.handle('locations:list', () => {
    const locations = db.prepare('SELECT * FROM locations ORDER BY name').all() as Array<{
      id: number
      name: string
      type: string
      description: string
    }>
    return locations.map((loc) => {
      const count = db.prepare('SELECT COUNT(*) as c FROM items WHERE location = ?').get(loc.name) as { c: number }
      return { ...loc, itemCount: count.c }
    })
  })

  ipcMain.handle(
    'locations:create',
    (_e, data: { name: string; type: string; description: string }) => {
      const stmt = db.prepare('INSERT INTO locations (name, type, description) VALUES (?, ?, ?)')
      const result = stmt.run(data.name, data.type, data.description)
      return db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  // ── Activity ───────────────────────────────────────────────

  ipcMain.handle('activity:list', (_e, limit = 50) => {
    return db.prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?').all(limit)
  })

  // ── Labels ─────────────────────────────────────────────────

  ipcMain.handle('labels:list', () => {
    return db.prepare('SELECT * FROM labels ORDER BY created_at DESC').all()
  })

  ipcMain.handle(
    'labels:create',
    (_e, data: { name: string; barcode: string; notes: string }) => {
      const stmt = db.prepare('INSERT INTO labels (name, barcode, notes) VALUES (?, ?, ?)')
      const result = stmt.run(data.name, data.barcode, data.notes)
      logActivity('create', data.name, data.barcode, 'Label created')
      return db.prepare('SELECT * FROM labels WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle('labels:delete', (_e, id: number) => {
    const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as
      | { name: string; barcode: string }
      | undefined
    if (label) {
      logActivity('delete', label.name, label.barcode, 'Label deleted')
    }
    db.prepare('DELETE FROM labels WHERE id = ?').run(id)
  })

  // ── Barcode ────────────────────────────────────────────────

  ipcMain.handle('barcode:generate', async (_e, text: string, opts?: { scale?: number }) => {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: opts?.scale ?? 3,
      height: 10,
      includetext: true,
      textxalign: 'center'
    })
    return png.toString('base64')
  })

  // ── Export / Import ────────────────────────────────────────

  ipcMain.handle('data:export-csv', () => {
    const items = db.prepare('SELECT name, barcode, category, quantity, location FROM items ORDER BY name').all() as Array<{
      name: string
      barcode: string
      category: string
      quantity: number
      location: string
    }>
    const header = 'name,barcode,category,quantity,location'
    const rows = items.map(
      (i) => `"${i.name}","${i.barcode}","${i.category}",${i.quantity},"${i.location}"`
    )
    return [header, ...rows].join('\n')
  })

  ipcMain.handle('data:import-csv', (_e, csvContent: string) => {
    const lines = csvContent.trim().split('\n')
    if (lines.length < 2) return { imported: 0 }

    const insert = db.prepare(
      'INSERT OR IGNORE INTO items (name, barcode, category, quantity, location) VALUES (?, ?, ?, ?, ?)'
    )

    let imported = 0
    const tx = db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
        if (cols.length >= 2) {
          insert.run(cols[0], cols[1], cols[2] ?? '', Number(cols[3]) || 0, cols[4] ?? '')
          imported++
        }
      }
    })
    tx()

    logActivity('create', '', '', `Imported ${imported} items from CSV`)
    return { imported }
  })

  ipcMain.handle('data:reset', () => {
    db.exec('DELETE FROM activity; DELETE FROM items; DELETE FROM locations; DELETE FROM labels;')
    logActivity('delete', '', '', 'Database reset')
  })

  // ── Helpers ────────────────────────────────────────────────

  function logActivity(type: string, itemName: string, barcode: string, detail: string): void {
    db.prepare('INSERT INTO activity (type, item_name, barcode, detail) VALUES (?, ?, ?, ?)').run(
      type,
      itemName,
      barcode,
      detail
    )
  }
}
