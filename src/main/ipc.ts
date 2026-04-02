import { ipcMain, dialog, BrowserWindow, nativeTheme, shell, nativeImage } from 'electron'
import { getDatabase } from './database'
import bwipjs from 'bwip-js'
import { join, basename } from 'path'
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'fs'
import { createConnection } from 'net'

export function registerIpcHandlers(): void {
  const db = getDatabase()

  // ── Items ──────────────────────────────────────────────────

  ipcMain.handle('items:list', () => {
    return db.prepare('SELECT * FROM items WHERE deleted_at IS NULL ORDER BY name').all()
  })

  ipcMain.handle('items:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) ?? null
  })

  ipcMain.handle('items:get-by-barcode', (_e, barcode: string) => {
    return db.prepare('SELECT * FROM items WHERE barcode = ?').get(barcode) ?? null
  })

  ipcMain.handle(
    'items:create',
    (
      _e,
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
    ) => {
      const stmt = db.prepare(
        'INSERT INTO items (name, make, model, barcode, category, serial_number, quantity, location, retail_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      const result = stmt.run(
        data.name,
        data.make ?? '',
        data.model ?? '',
        data.barcode,
        data.category ?? '',
        data.serial_number ?? '',
        data.quantity,
        data.location ?? '',
        data.retail_value ?? 0
      )

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

    logActivity(
      'update',
      item.name,
      item.barcode,
      `Quantity changed: ${item.quantity} → ${quantity}`
    )

    return db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  })

  ipcMain.handle(
    'items:update',
    (
      _e,
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
    ) => {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
        | { name: string; barcode: string }
        | undefined
      if (!item) return null

      db.prepare(
        "UPDATE items SET name = ?, make = ?, model = ?, barcode = ?, category = ?, serial_number = ?, quantity = ?, location = ?, retail_value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(
        data.name,
        data.make ?? '',
        data.model ?? '',
        data.barcode,
        data.category ?? '',
        data.serial_number ?? '',
        data.quantity,
        data.location ?? '',
        data.retail_value ?? 0,
        id
      )

      logActivity('update', data.name, data.barcode, 'Item updated')

      return db.prepare('SELECT * FROM items WHERE id = ?').get(id)
    }
  )

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
      const count = db
        .prepare('SELECT COUNT(*) as c FROM items WHERE location = ?')
        .get(loc.name) as { c: number }
      return { ...loc, itemCount: count.c }
    })
  })

  ipcMain.handle('locations:get', (_e, id: number) => {
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as
      | { id: number; name: string; type: string; description: string }
      | undefined
    if (!loc) return null
    const count = db
      .prepare('SELECT COUNT(*) as c FROM items WHERE location = ?')
      .get(loc.name) as { c: number }
    return { ...loc, itemCount: count.c }
  })

  ipcMain.handle(
    'locations:create',
    (_e, data: { name: string; type: string; description: string }) => {
      const stmt = db.prepare('INSERT INTO locations (name, type, description) VALUES (?, ?, ?)')
      const result = stmt.run(data.name, data.type, data.description)
      return db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle(
    'locations:update',
    (_e, id: number, data: { name: string; type: string; description: string }) => {
      const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as
        | { name: string }
        | undefined
      if (!loc) return null

      // Update items referencing the old location name
      if (loc.name !== data.name) {
        db.prepare('UPDATE items SET location = ? WHERE location = ?').run(data.name, loc.name)
      }

      db.prepare('UPDATE locations SET name = ?, type = ?, description = ? WHERE id = ?').run(
        data.name,
        data.type,
        data.description,
        id
      )

      const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as {
        id: number
        name: string
        type: string
        description: string
      }
      const count = db
        .prepare('SELECT COUNT(*) as c FROM items WHERE location = ?')
        .get(updated.name) as { c: number }
      return { ...updated, itemCount: count.c }
    }
  )

  ipcMain.handle('locations:delete', (_e, id: number) => {
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as
      | { name: string }
      | undefined
    if (loc) {
      db.prepare("UPDATE items SET location = '' WHERE location = ?").run(loc.name)
    }
    db.prepare('DELETE FROM locations WHERE id = ?').run(id)
  })

  // ── Activity ───────────────────────────────────────────────

  ipcMain.handle('activity:list', (_e, limit = 50) => {
    return db.prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?').all(limit)
  })

  // ── Labels ─────────────────────────────────────────────────

  ipcMain.handle('labels:list', () => {
    return db.prepare('SELECT * FROM labels ORDER BY created_at DESC').all()
  })

  ipcMain.handle('labels:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM labels WHERE id = ?').get(id) ?? null
  })

  ipcMain.handle('labels:create', (_e, data: { name: string; barcode: string; notes: string }) => {
    const stmt = db.prepare('INSERT INTO labels (name, barcode, notes) VALUES (?, ?, ?)')
    const result = stmt.run(data.name, data.barcode, data.notes)
    logActivity('create', data.name, data.barcode, 'Label created')
    return db.prepare('SELECT * FROM labels WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle(
    'labels:update',
    (_e, id: number, data: { name: string; barcode: string; notes: string }) => {
      const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as
        | { name: string; barcode: string }
        | undefined
      if (!label) return null

      db.prepare('UPDATE labels SET name = ?, barcode = ?, notes = ? WHERE id = ?').run(
        data.name,
        data.barcode,
        data.notes,
        id
      )

      logActivity('update', data.name, data.barcode, 'Label updated')

      return db.prepare('SELECT * FROM labels WHERE id = ?').get(id)
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

  // ── Printing ───────────────────────────────────────────────

  ipcMain.handle('print:get-printers', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return []
    return win.webContents.getPrintersAsync()
  })

  ipcMain.handle(
    'print:label',
    async (_e, data: { name: string; barcode: string; labelSize: string; printerName: string }) => {
      const scale = data.labelSize === 'large' ? 4 : data.labelSize === 'medium' ? 3 : 2
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: data.barcode,
        scale,
        height: data.labelSize === 'large' ? 15 : data.labelSize === 'medium' ? 12 : 8,
        includetext: true,
        textxalign: 'center'
      })
      const base64 = png.toString('base64')
      const imgWidth = data.labelSize === 'large' ? 380 : data.labelSize === 'medium' ? 300 : 220

      const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
      const html = `<html><body style="margin:0;text-align:center;padding:8px">
        <p style="margin:0 0 4px;font-family:sans-serif;font-size:${data.labelSize === 'small' ? 10 : 13}px;font-weight:bold">${data.name.replace(/</g, '&lt;')}</p>
        <img src="data:image/png;base64,${base64}" width="${imgWidth}" />
      </body></html>`
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      return new Promise<boolean>((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            deviceName: data.printerName,
            printBackground: true
          },
          (success) => {
            printWin.close()
            if (success) {
              logActivity('print', data.name, data.barcode, `Printed label (${data.labelSize})`)
            }
            resolve(success)
          }
        )
      })
    }
  )

  // ── Export / Import ────────────────────────────────────────

  ipcMain.handle('data:export-csv', () => {
    const items = db
      .prepare('SELECT name, barcode, category, quantity, location FROM items ORDER BY name')
      .all() as Array<{
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
    db.exec(
      'DELETE FROM activity; DELETE FROM checkouts; DELETE FROM items; DELETE FROM locations; DELETE FROM labels;'
    )
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

  // ── Check-In / Check-Out ──────────────────────────────────

  ipcMain.handle(
    'checkouts:create',
    (
      _e,
      data: {
        item_id: number
        checked_out_to: string
        checked_out_by: string
        department: string
        notes: string
        due_date: string | null
        condition_out: string
      }
    ) => {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(data.item_id) as
        | { name: string; barcode: string; quantity: number }
        | undefined
      if (!item) return null

      const stmt = db.prepare(
        'INSERT INTO checkouts (item_id, checked_out_to, checked_out_by, department, notes, due_date, condition_out) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      const result = stmt.run(
        data.item_id,
        data.checked_out_to,
        data.checked_out_by,
        data.department,
        data.notes,
        data.due_date,
        data.condition_out
      )

      // Decrement item quantity
      db.prepare(
        "UPDATE items SET quantity = MAX(0, quantity - 1), updated_at = datetime('now') WHERE id = ?"
      ).run(data.item_id)

      logActivity('update', item.name, item.barcode, `Checked out to ${data.checked_out_to}`)

      return db.prepare('SELECT * FROM checkouts WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle(
    'checkouts:checkin',
    (_e, checkoutId: number, data: { checked_in_by: string; condition_in: string }) => {
      const checkout = db
        .prepare('SELECT * FROM checkouts WHERE id = ? AND checked_in_at IS NULL')
        .get(checkoutId) as { item_id: number; checked_out_to: string } | undefined
      if (!checkout) return null

      db.prepare(
        "UPDATE checkouts SET checked_in_at = datetime('now'), checked_in_by = ?, condition_in = ? WHERE id = ?"
      ).run(data.checked_in_by, data.condition_in, checkoutId)

      // Increment item quantity
      db.prepare(
        "UPDATE items SET quantity = quantity + 1, updated_at = datetime('now') WHERE id = ?"
      ).run(checkout.item_id)

      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(checkout.item_id) as
        | { name: string; barcode: string }
        | undefined

      if (item) {
        logActivity('update', item.name, item.barcode, `Checked in from ${checkout.checked_out_to}`)
      }

      return db.prepare('SELECT * FROM checkouts WHERE id = ?').get(checkoutId)
    }
  )

  ipcMain.handle('checkouts:list', (_e, itemId: number) => {
    return db
      .prepare('SELECT * FROM checkouts WHERE item_id = ? ORDER BY checked_out_at DESC')
      .all(itemId)
  })

  ipcMain.handle('checkouts:active', (_e, itemId: number) => {
    return db
      .prepare(
        'SELECT * FROM checkouts WHERE item_id = ? AND checked_in_at IS NULL ORDER BY checked_out_at DESC'
      )
      .all(itemId)
  })

  ipcMain.handle('checkouts:active-count', () => {
    const row = db
      .prepare('SELECT COUNT(*) as c FROM checkouts WHERE checked_in_at IS NULL')
      .get() as { c: number }
    return row.c
  })

  // ── Settings ───────────────────────────────────────────────

  ipcMain.handle('settings:get', (_e, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })

  ipcMain.handle('settings:get-all', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string
      value: string
    }>
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  })

  // ── Theme ──────────────────────────────────────────────────

  ipcMain.handle('theme:set', (_e, theme: 'system' | 'dark' | 'light') => {
    nativeTheme.themeSource = theme
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)").run(theme)
  })

  ipcMain.handle('theme:get', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as
      | { value: string }
      | undefined
    return row?.value ?? 'system'
  })

  // ── Storage Path ───────────────────────────────────────────

  ipcMain.handle('storage-path:select', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Storage Directory'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const selected = result.filePaths[0]
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('storagePath', ?)").run(
      selected
    )
    return selected
  })

  // ── Item Files ─────────────────────────────────────────────

  function getItemDir(itemId: number, subfolder: 'images' | 'docs'): string {
    const spRow = db.prepare("SELECT value FROM settings WHERE key = 'storagePath'").get() as
      | { value: string }
      | undefined
    const base = spRow?.value ?? ''
    const dir = join(base, 'items', String(itemId), subfolder)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }

  ipcMain.handle('item-files:pick-image', async (_e, itemId: number) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select Item Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    const dir = getItemDir(itemId, 'images')
    const dest = join(dir, basename(src))
    copyFileSync(src, dest)
    return dest
  })

  ipcMain.handle('item-files:pick-doc', async (_e, itemId: number) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Attach Documentation',
      filters: [
        {
          name: 'Documents',
          extensions: [
            'pdf',
            'doc',
            'docx',
            'txt',
            'md',
            'xls',
            'xlsx',
            'csv',
            'jpg',
            'jpeg',
            'png'
          ]
        }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return []
    const dir = getItemDir(itemId, 'docs')
    const saved: string[] = []
    for (const src of result.filePaths) {
      const dest = join(dir, basename(src))
      copyFileSync(src, dest)
      saved.push(dest)
    }
    return saved
  })

  ipcMain.handle('item-files:list-images', (_e, itemId: number) => {
    const dir = getItemDir(itemId, 'images')
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => !f.startsWith('.'))
      .map((f) => join(dir, f))
  })

  ipcMain.handle('item-files:list-docs', (_e, itemId: number) => {
    const dir = getItemDir(itemId, 'docs')
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => !f.startsWith('.'))
      .map((f) => ({
        path: join(dir, f),
        name: f,
        size: statSync(join(dir, f)).size
      }))
  })

  ipcMain.handle('item-files:delete', (_e, filePath: string) => {
    if (existsSync(filePath)) unlinkSync(filePath)
  })

  ipcMain.handle('item-files:open', (_e, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle('item-files:thumbnail', async (_e, filePath: string) => {
    if (!existsSync(filePath)) return null
    try {
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: 224, height: 224 })
      return img.toDataURL()
    } catch {
      return null
    }
  })

  // ── Soft Delete / Trash ────────────────────────────────────

  ipcMain.handle('items:soft-delete', (_e, id: number) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
      | { name: string; barcode: string }
      | undefined
    if (item) {
      db.prepare("UPDATE items SET deleted_at = datetime('now') WHERE id = ?").run(id)
      logActivity('delete', item.name, item.barcode, 'Item moved to trash')
    }
  })

  ipcMain.handle('items:restore', (_e, id: number) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
      | { name: string; barcode: string }
      | undefined
    if (item) {
      db.prepare('UPDATE items SET deleted_at = NULL WHERE id = ?').run(id)
      logActivity('create', item.name, item.barcode, 'Item restored from trash')
    }
  })

  ipcMain.handle('items:list-trash', () => {
    return db
      .prepare('SELECT * FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC')
      .all()
  })

  ipcMain.handle('items:empty-trash', () => {
    db.prepare('DELETE FROM items WHERE deleted_at IS NOT NULL').run()
  })

  // ── Bulk Operations ────────────────────────────────────────

  ipcMain.handle('items:bulk-delete', (_e, ids: number[]) => {
    const del = db.prepare("UPDATE items SET deleted_at = datetime('now') WHERE id = ?")
    const tx = db.transaction(() => {
      for (const id of ids) del.run(id)
    })
    tx()
    logActivity('delete', '', '', `Bulk deleted ${ids.length} items`)
  })

  ipcMain.handle('items:bulk-move', (_e, ids: number[], location: string) => {
    const upd = db.prepare(
      "UPDATE items SET location = ?, updated_at = datetime('now') WHERE id = ?"
    )
    const tx = db.transaction(() => {
      for (const id of ids) upd.run(location, id)
    })
    tx()
    logActivity('update', '', '', `Bulk moved ${ids.length} items to ${location}`)
  })

  // ── Item History (Activity by barcode) ─────────────────────

  ipcMain.handle('activity:by-barcode', (_e, barcode: string) => {
    return db
      .prepare('SELECT * FROM activity WHERE barcode = ? ORDER BY timestamp DESC LIMIT 100')
      .all(barcode)
  })

  // ── Categories ─────────────────────────────────────────────

  ipcMain.handle('categories:list', () => {
    const cats = db.prepare('SELECT * FROM categories ORDER BY name').all() as Array<{
      id: number
      name: string
      color: string
    }>
    return cats.map((c) => {
      const count = db
        .prepare('SELECT COUNT(*) as cnt FROM items WHERE category = ? AND deleted_at IS NULL')
        .get(c.name) as { cnt: number }
      return { ...c, itemCount: count.cnt }
    })
  })

  ipcMain.handle('categories:create', (_e, data: { name: string; color: string }) => {
    const stmt = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
    const result = stmt.run(data.name, data.color)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('categories:update', (_e, id: number, data: { name: string; color: string }) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
      | { name: string }
      | undefined
    if (!cat) return null
    if (cat.name !== data.name) {
      db.prepare('UPDATE items SET category = ? WHERE category = ?').run(data.name, cat.name)
    }
    db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(
      data.name,
      data.color,
      id
    )
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  })

  ipcMain.handle('categories:delete', (_e, id: number) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
      | { name: string }
      | undefined
    if (cat) {
      db.prepare("UPDATE items SET category = '' WHERE category = ?").run(cat.name)
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  })

  // ── Custom Fields ──────────────────────────────────────────

  ipcMain.handle('custom-fields:list', () => {
    return db.prepare('SELECT * FROM custom_fields ORDER BY name').all()
  })

  ipcMain.handle(
    'custom-fields:create',
    (_e, data: { name: string; field_type: string; options: string }) => {
      const stmt = db.prepare(
        'INSERT INTO custom_fields (name, field_type, options) VALUES (?, ?, ?)'
      )
      const result = stmt.run(data.name, data.field_type, data.options)
      return db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle('custom-fields:delete', (_e, id: number) => {
    db.prepare('DELETE FROM custom_field_values WHERE field_id = ?').run(id)
    db.prepare('DELETE FROM custom_fields WHERE id = ?').run(id)
  })

  ipcMain.handle('custom-fields:get-values', (_e, itemId: number) => {
    return db
      .prepare(
        'SELECT cfv.field_id, cfv.value, cf.name, cf.field_type FROM custom_field_values cfv JOIN custom_fields cf ON cf.id = cfv.field_id WHERE cfv.item_id = ?'
      )
      .all(itemId)
  })

  ipcMain.handle(
    'custom-fields:set-value',
    (_e, itemId: number, fieldId: number, value: string) => {
      db.prepare(
        'INSERT OR REPLACE INTO custom_field_values (item_id, field_id, value) VALUES (?, ?, ?)'
      ).run(itemId, fieldId, value)
    }
  )

  // ── Overdue Checkouts ──────────────────────────────────────

  ipcMain.handle('checkouts:overdue', () => {
    return db
      .prepare(
        `SELECT c.*, i.name as item_name, i.barcode as item_barcode
         FROM checkouts c
         JOIN items i ON i.id = c.item_id
         WHERE c.checked_in_at IS NULL
           AND c.due_date IS NOT NULL
           AND c.due_date < datetime('now')
         ORDER BY c.due_date ASC`
      )
      .all()
  })

  ipcMain.handle('checkouts:overdue-count', () => {
    const row = db
      .prepare(
        "SELECT COUNT(*) as c FROM checkouts WHERE checked_in_at IS NULL AND due_date IS NOT NULL AND due_date < datetime('now')"
      )
      .get() as { c: number }
    return row.c
  })

  // ── Checkout Stats ─────────────────────────────────────────

  ipcMain.handle('checkouts:stats', () => {
    const totalActive = db
      .prepare('SELECT COUNT(*) as c FROM checkouts WHERE checked_in_at IS NULL')
      .get() as { c: number }
    const totalOverdue = db
      .prepare(
        "SELECT COUNT(*) as c FROM checkouts WHERE checked_in_at IS NULL AND due_date IS NOT NULL AND due_date < datetime('now')"
      )
      .get() as { c: number }
    const topCheckedOut = db
      .prepare(
        `SELECT i.name, COUNT(*) as cnt
         FROM checkouts c JOIN items i ON i.id = c.item_id
         GROUP BY c.item_id ORDER BY cnt DESC LIMIT 5`
      )
      .all() as Array<{ name: string; cnt: number }>
    const topUsers = db
      .prepare(
        'SELECT checked_out_to as name, COUNT(*) as cnt FROM checkouts GROUP BY checked_out_to ORDER BY cnt DESC LIMIT 5'
      )
      .all() as Array<{ name: string; cnt: number }>
    const avgDuration = db
      .prepare(
        `SELECT AVG(julianday(checked_in_at) - julianday(checked_out_at)) as avg_days
         FROM checkouts WHERE checked_in_at IS NOT NULL`
      )
      .get() as { avg_days: number | null }

    return {
      activeCount: totalActive.c,
      overdueCount: totalOverdue.c,
      topCheckedOut,
      topUsers,
      avgDurationDays: avgDuration.avg_days ? Math.round(avgDuration.avg_days * 10) / 10 : 0
    }
  })

  // ── Dashboard Stats ────────────────────────────────────────

  ipcMain.handle('dashboard:stats', () => {
    const totalItems = db
      .prepare('SELECT COUNT(*) as c FROM items WHERE deleted_at IS NULL')
      .get() as { c: number }
    const totalUnits = db
      .prepare('SELECT COALESCE(SUM(quantity), 0) as s FROM items WHERE deleted_at IS NULL')
      .get() as { s: number }
    const totalValue = db
      .prepare(
        'SELECT COALESCE(SUM(retail_value * quantity), 0) as v FROM items WHERE deleted_at IS NULL'
      )
      .get() as { v: number }
    const categoryBreakdown = db
      .prepare(
        "SELECT CASE WHEN category = '' THEN 'Uncategorized' ELSE category END as name, COUNT(*) as count FROM items WHERE deleted_at IS NULL GROUP BY category ORDER BY count DESC"
      )
      .all() as Array<{ name: string; count: number }>

    return {
      totalItems: totalItems.c,
      totalUnits: totalUnits.s,
      totalValue: totalValue.v,
      categoryBreakdown
    }
  })

  // ── QR Code Generation ─────────────────────────────────────

  ipcMain.handle('barcode:generate-qr', async (_e, text: string, opts?: { scale?: number }) => {
    const png = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text,
      scale: opts?.scale ?? 4,
      height: 30,
      width: 30
    })
    return png.toString('base64')
  })

  // ── Remote Database ────────────────────────────────────────

  ipcMain.handle(
    'remote-db:test',
    async (
      _e,
      config: {
        engine: 'mysql' | 'mariadb' | 'postgres'
        host: string
        port: number
        database: string
        user: string
        password: string
      }
    ): Promise<{ ok: boolean; error?: string }> => {
      const port = config.port || (config.engine === 'postgres' ? 5432 : 3306)
      return new Promise((resolve) => {
        const socket = createConnection({ host: config.host, port }, () => {
          socket.destroy()
          resolve({ ok: true })
        })
        socket.setTimeout(5000)
        socket.on('timeout', () => {
          socket.destroy()
          resolve({ ok: false, error: 'Connection timed out' })
        })
        socket.on('error', (err) => {
          resolve({ ok: false, error: err.message })
        })
      })
    }
  )

  ipcMain.handle(
    'remote-db:save',
    (
      _e,
      config: {
        engine: 'mysql' | 'mariadb' | 'postgres'
        host: string
        port: number
        database: string
        user: string
        password: string
      }
    ) => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('remoteDbConfig', ?)").run(
        JSON.stringify(config)
      )
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dbMode', 'remote')").run()
    }
  )

  ipcMain.handle('remote-db:disconnect', () => {
    db.prepare("DELETE FROM settings WHERE key = 'remoteDbConfig'").run()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dbMode', 'local')").run()
  })

  ipcMain.handle('remote-db:get-mode', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'dbMode'").get() as
      | { value: string }
      | undefined
    return row?.value ?? 'local'
  })

  ipcMain.handle('remote-db:get-config', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'remoteDbConfig'").get() as
      | { value: string }
      | undefined
    if (!row) return null
    return JSON.parse(row.value)
  })
}
