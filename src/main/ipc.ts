import { ipcMain, dialog, BrowserWindow, nativeTheme, shell, nativeImage } from 'electron'
import { getRawDb, getDataDb, connectRemote, disconnectRemote, getMode } from './database'
import { Pool } from 'pg'
import { eq, and, isNull, isNotNull, desc, asc, count, sql, inArray } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import bwipjs from 'bwip-js'
import { join, basename } from 'path'
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'fs'

async function logActivity(
  type: string,
  itemName: string,
  barcode: string,
  detail: string
): Promise<void> {
  const { db, s } = getDataDb()
  await db.insert(s.activity).values({ type, item_name: itemName, barcode, detail })
}

export function registerIpcHandlers(): void {
  const rawDb = getRawDb()

  // ── Items ──────────────────────────────────────────────────

  ipcMain.handle('items:list', async () => {
    const { db, s } = getDataDb()
    return db
      .select()
      .from(s.items)
      .where(isNull(s.items.deleted_at))
      .orderBy(asc(s.items.name))
  })

  ipcMain.handle('items:get', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.id, id))
    return rows[0] ?? null
  })

  ipcMain.handle('items:get-by-barcode', async (_e, barcode: string) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.barcode, barcode))
    return rows[0] ?? null
  })

  ipcMain.handle(
    'items:create',
    async (
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
      const { db, s } = getDataDb()
      const [result] = await db
        .insert(s.items)
        .values({
          name: data.name,
          make: data.make ?? '',
          model: data.model ?? '',
          barcode: data.barcode,
          category: data.category ?? '',
          serial_number: data.serial_number ?? '',
          quantity: data.quantity,
          location: data.location ?? '',
          retail_value: data.retail_value ?? 0
        })
        .returning()

      await logActivity(
        'create',
        data.name,
        data.barcode,
        `New item created, qty: ${data.quantity}`
      )
      return result
    }
  )

  ipcMain.handle('items:update-quantity', async (_e, id: number, quantity: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.id, id))
    const item = rows[0]
    if (!item) return null

    const now = new Date().toISOString()
    const [updated] = await db
      .update(s.items)
      .set({ quantity, updated_at: now })
      .where(eq(s.items.id, id))
      .returning()

    await logActivity(
      'update',
      item.name,
      item.barcode,
      `Quantity changed: ${item.quantity} → ${quantity}`
    )
    return updated
  })

  ipcMain.handle(
    'items:update',
    async (
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
      const { db, s } = getDataDb()
      const rows = await db.select().from(s.items).where(eq(s.items.id, id))
      if (!rows[0]) return null

      const now = new Date().toISOString()
      const [updated] = await db
        .update(s.items)
        .set({
          name: data.name,
          make: data.make ?? '',
          model: data.model ?? '',
          barcode: data.barcode,
          category: data.category ?? '',
          serial_number: data.serial_number ?? '',
          quantity: data.quantity,
          location: data.location ?? '',
          retail_value: data.retail_value ?? 0,
          updated_at: now
        })
        .where(eq(s.items.id, id))
        .returning()

      await logActivity('update', data.name, data.barcode, 'Item updated')
      return updated
    }
  )

  ipcMain.handle('items:delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.id, id))
    if (rows[0]) {
      await logActivity('delete', rows[0].name, rows[0].barcode, 'Item removed from inventory')
    }
    await db.delete(s.items).where(eq(s.items.id, id))
  })

  // ── Locations ──────────────────────────────────────────────

  ipcMain.handle('locations:list', async () => {
    const { db, s } = getDataDb()
    const locs = await db.select().from(s.locations).orderBy(asc(s.locations.name))

    const counts = await db
      .select({ location: s.items.location, c: count() })
      .from(s.items)
      .where(isNull(s.items.deleted_at))
      .groupBy(s.items.location)
    const countMap = new Map(counts.map((r) => [r.location, Number(r.c)]))

    return locs.map((loc) => ({ ...loc, itemCount: countMap.get(loc.name) ?? 0 }))
  })

  ipcMain.handle('locations:get', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.locations).where(eq(s.locations.id, id))
    const loc = rows[0]
    if (!loc) return null
    const [countRow] = await db
      .select({ c: count() })
      .from(s.items)
      .where(and(eq(s.items.location, loc.name), isNull(s.items.deleted_at)))
    return { ...loc, itemCount: Number(countRow?.c) ?? 0 }
  })

  ipcMain.handle(
    'locations:create',
    async (_e, data: { name: string; type: string; description: string }) => {
      const { db, s } = getDataDb()
      const [result] = await db
        .insert(s.locations)
        .values({ name: data.name, type: data.type, description: data.description })
        .returning()
      return result
    }
  )

  ipcMain.handle(
    'locations:update',
    async (_e, id: number, data: { name: string; type: string; description: string }) => {
      const { db, s } = getDataDb()
      const rows = await db.select().from(s.locations).where(eq(s.locations.id, id))
      const loc = rows[0]
      if (!loc) return null

      if (loc.name !== data.name) {
        await db
          .update(s.items)
          .set({ location: data.name })
          .where(eq(s.items.location, loc.name))
      }

      const [updated] = await db
        .update(s.locations)
        .set({ name: data.name, type: data.type, description: data.description })
        .where(eq(s.locations.id, id))
        .returning()

      const [countRow] = await db
        .select({ c: count() })
        .from(s.items)
        .where(and(eq(s.items.location, updated.name), isNull(s.items.deleted_at)))
      return { ...updated, itemCount: Number(countRow?.c) ?? 0 }
    }
  )

  ipcMain.handle('locations:delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.locations).where(eq(s.locations.id, id))
    if (rows[0]) {
      await db
        .update(s.items)
        .set({ location: '' })
        .where(eq(s.items.location, rows[0].name))
    }
    await db.delete(s.locations).where(eq(s.locations.id, id))
  })

  // ── Activity ───────────────────────────────────────────────

  ipcMain.handle('activity:list', async (_e, limit = 50) => {
    const { db, s } = getDataDb()
    return db.select().from(s.activity).orderBy(desc(s.activity.timestamp)).limit(limit)
  })

  // ── Labels ─────────────────────────────────────────────────

  ipcMain.handle('labels:list', async () => {
    const { db, s } = getDataDb()
    return db.select().from(s.labels).orderBy(desc(s.labels.created_at))
  })

  ipcMain.handle('labels:get', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.labels).where(eq(s.labels.id, id))
    return rows[0] ?? null
  })

  ipcMain.handle(
    'labels:create',
    async (_e, data: { name: string; barcode: string; notes: string }) => {
      const { db, s } = getDataDb()
      const [result] = await db
        .insert(s.labels)
        .values({ name: data.name, barcode: data.barcode, notes: data.notes })
        .returning()
      await logActivity('create', data.name, data.barcode, 'Label created')
      return result
    }
  )

  ipcMain.handle(
    'labels:update',
    async (_e, id: number, data: { name: string; barcode: string; notes: string }) => {
      const { db, s } = getDataDb()
      const rows = await db.select().from(s.labels).where(eq(s.labels.id, id))
      if (!rows[0]) return null

      const [updated] = await db
        .update(s.labels)
        .set({ name: data.name, barcode: data.barcode, notes: data.notes })
        .where(eq(s.labels.id, id))
        .returning()

      await logActivity('update', data.name, data.barcode, 'Label updated')
      return updated
    }
  )

  ipcMain.handle('labels:delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.labels).where(eq(s.labels.id, id))
    if (rows[0]) {
      await logActivity('delete', rows[0].name, rows[0].barcode, 'Label deleted')
    }
    await db.delete(s.labels).where(eq(s.labels.id, id))
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
    async (
      _e,
      data: { name: string; barcode: string; labelSize: string; printerName: string }
    ) => {
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

  ipcMain.handle('data:export-csv', async () => {
    const { db, s } = getDataDb()
    const rows = await db
      .select({
        name: s.items.name,
        barcode: s.items.barcode,
        category: s.items.category,
        quantity: s.items.quantity,
        location: s.items.location
      })
      .from(s.items)
      .orderBy(asc(s.items.name))

    const header = 'name,barcode,category,quantity,location'
    const csvRows = rows.map(
      (i) => `"${i.name}","${i.barcode}","${i.category}",${i.quantity},"${i.location}"`
    )
    return [header, ...csvRows].join('\n')
  })

  ipcMain.handle('data:import-csv', async (_e, csvContent: string) => {
    const { db, s } = getDataDb()
    const lines = csvContent.trim().split('\n')
    if (lines.length < 2) return { imported: 0 }

    let imported = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
      if (cols.length >= 2) {
        await db
          .insert(s.items)
          .values({
            name: cols[0],
            barcode: cols[1],
            category: cols[2] ?? '',
            quantity: Number(cols[3]) || 0,
            location: cols[4] ?? ''
          })
          .onConflictDoNothing({ target: s.items.barcode })
        imported++
      }
    }

    await logActivity('create', '', '', `Imported ${imported} items from CSV`)
    return { imported }
  })

  ipcMain.handle('data:reset', async () => {
    const { db, s } = getDataDb()
    await db.delete(s.activity)
    await db.delete(s.checkouts)
    await db.delete(s.customFieldValues)
    await db.delete(s.items)
    await db.delete(s.locations)
    await db.delete(s.labels)
    await logActivity('delete', '', '', 'Database reset')
  })

  // ── Check-In / Check-Out ──────────────────────────────────

  ipcMain.handle(
    'checkouts:create',
    async (
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
      const { db, s } = getDataDb()
      const rows = await db.select().from(s.items).where(eq(s.items.id, data.item_id))
      const item = rows[0]
      if (!item) return null

      const [result] = await db
        .insert(s.checkouts)
        .values({
          item_id: data.item_id,
          checked_out_to: data.checked_out_to,
          checked_out_by: data.checked_out_by,
          department: data.department,
          notes: data.notes,
          due_date: data.due_date,
          condition_out: data.condition_out
        })
        .returning()

      const now = new Date().toISOString()
      const newQty = Math.max(0, item.quantity - 1)
      await db
        .update(s.items)
        .set({ quantity: newQty, updated_at: now })
        .where(eq(s.items.id, data.item_id))

      await logActivity(
        'update',
        item.name,
        item.barcode,
        `Checked out to ${data.checked_out_to}`
      )
      return result
    }
  )

  ipcMain.handle(
    'checkouts:checkin',
    async (_e, checkoutId: number, data: { checked_in_by: string; condition_in: string }) => {
      const { db, s } = getDataDb()
      const coRows = await db
        .select()
        .from(s.checkouts)
        .where(and(eq(s.checkouts.id, checkoutId), isNull(s.checkouts.checked_in_at)))
      const checkout = coRows[0]
      if (!checkout) return null

      const now = new Date().toISOString()
      await db
        .update(s.checkouts)
        .set({
          checked_in_at: now,
          checked_in_by: data.checked_in_by,
          condition_in: data.condition_in
        })
        .where(eq(s.checkouts.id, checkoutId))

      // Increment item quantity
      const itemRows = await db.select().from(s.items).where(eq(s.items.id, checkout.item_id))
      const item = itemRows[0]
      if (item) {
        await db
          .update(s.items)
          .set({ quantity: item.quantity + 1, updated_at: now })
          .where(eq(s.items.id, checkout.item_id))
        await logActivity(
          'update',
          item.name,
          item.barcode,
          `Checked in from ${checkout.checked_out_to}`
        )
      }

      const [updated] = await db
        .select()
        .from(s.checkouts)
        .where(eq(s.checkouts.id, checkoutId))
      return updated
    }
  )

  ipcMain.handle('checkouts:list', async (_e, itemId: number) => {
    const { db, s } = getDataDb()
    return db
      .select()
      .from(s.checkouts)
      .where(eq(s.checkouts.item_id, itemId))
      .orderBy(desc(s.checkouts.checked_out_at))
  })

  ipcMain.handle('checkouts:active', async (_e, itemId: number) => {
    const { db, s } = getDataDb()
    return db
      .select()
      .from(s.checkouts)
      .where(and(eq(s.checkouts.item_id, itemId), isNull(s.checkouts.checked_in_at)))
      .orderBy(desc(s.checkouts.checked_out_at))
  })

  ipcMain.handle('checkouts:active-count', async () => {
    const { db, s } = getDataDb()
    const [row] = await db
      .select({ c: count() })
      .from(s.checkouts)
      .where(isNull(s.checkouts.checked_in_at))
    return Number(row?.c) ?? 0
  })

  // ── Settings ───────────────────────────────────────────────

  ipcMain.handle('settings:get', (_e, key: string) => {
    const row = rawDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    rawDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })

  ipcMain.handle('settings:get-all', () => {
    const rows = rawDb.prepare('SELECT key, value FROM settings').all() as Array<{
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
    rawDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)").run(theme)
  })

  ipcMain.handle('theme:get', () => {
    const row = rawDb.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as
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
    rawDb
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('storagePath', ?)")
      .run(selected)
    return selected
  })

  // ── Item Files ─────────────────────────────────────────────

  function getItemDir(itemId: number, subfolder: 'images' | 'docs'): string {
    const spRow = rawDb.prepare("SELECT value FROM settings WHERE key = 'storagePath'").get() as
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

  ipcMain.handle('items:soft-delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.id, id))
    if (rows[0]) {
      const now = new Date().toISOString()
      await db.update(s.items).set({ deleted_at: now }).where(eq(s.items.id, id))
      await logActivity('delete', rows[0].name, rows[0].barcode, 'Item moved to trash')
    }
  })

  ipcMain.handle('items:restore', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.items).where(eq(s.items.id, id))
    if (rows[0]) {
      await db.update(s.items).set({ deleted_at: null }).where(eq(s.items.id, id))
      await logActivity('create', rows[0].name, rows[0].barcode, 'Item restored from trash')
    }
  })

  ipcMain.handle('items:list-trash', async () => {
    const { db, s } = getDataDb()
    return db
      .select()
      .from(s.items)
      .where(isNotNull(s.items.deleted_at))
      .orderBy(desc(s.items.deleted_at))
  })

  ipcMain.handle('items:empty-trash', async () => {
    const { db, s } = getDataDb()
    await db.delete(s.items).where(isNotNull(s.items.deleted_at))
  })

  // ── Bulk Operations ────────────────────────────────────────

  ipcMain.handle('items:bulk-delete', async (_e, ids: number[]) => {
    const { db, s } = getDataDb()
    const now = new Date().toISOString()
    await db.update(s.items).set({ deleted_at: now }).where(inArray(s.items.id, ids))
    await logActivity('delete', '', '', `Bulk deleted ${ids.length} items`)
  })

  ipcMain.handle('items:bulk-move', async (_e, ids: number[], location: string) => {
    const { db, s } = getDataDb()
    const now = new Date().toISOString()
    await db
      .update(s.items)
      .set({ location, updated_at: now })
      .where(inArray(s.items.id, ids))
    await logActivity('update', '', '', `Bulk moved ${ids.length} items to ${location}`)
  })

  // ── Item History (Activity by barcode) ─────────────────────

  ipcMain.handle('activity:by-barcode', async (_e, barcode: string) => {
    const { db, s } = getDataDb()
    return db
      .select()
      .from(s.activity)
      .where(eq(s.activity.barcode, barcode))
      .orderBy(desc(s.activity.timestamp))
      .limit(100)
  })

  // ── Categories ─────────────────────────────────────────────

  ipcMain.handle('categories:list', async () => {
    const { db, s } = getDataDb()
    const cats = await db.select().from(s.categories).orderBy(asc(s.categories.name))

    const counts = await db
      .select({ category: s.items.category, cnt: count() })
      .from(s.items)
      .where(isNull(s.items.deleted_at))
      .groupBy(s.items.category)
    const countMap = new Map(counts.map((r) => [r.category, Number(r.cnt)]))

    return cats.map((c) => ({ ...c, itemCount: countMap.get(c.name) ?? 0 }))
  })

  ipcMain.handle('categories:create', async (_e, data: { name: string; color: string }) => {
    const { db, s } = getDataDb()
    const [result] = await db
      .insert(s.categories)
      .values({ name: data.name, color: data.color })
      .returning()
    return result
  })

  ipcMain.handle(
    'categories:update',
    async (_e, id: number, data: { name: string; color: string }) => {
      const { db, s } = getDataDb()
      const rows = await db.select().from(s.categories).where(eq(s.categories.id, id))
      if (!rows[0]) return null

      if (rows[0].name !== data.name) {
        await db
          .update(s.items)
          .set({ category: data.name })
          .where(eq(s.items.category, rows[0].name))
      }

      const [updated] = await db
        .update(s.categories)
        .set({ name: data.name, color: data.color })
        .where(eq(s.categories.id, id))
        .returning()
      return updated
    }
  )

  ipcMain.handle('categories:delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    const rows = await db.select().from(s.categories).where(eq(s.categories.id, id))
    if (rows[0]) {
      await db
        .update(s.items)
        .set({ category: '' })
        .where(eq(s.items.category, rows[0].name))
    }
    await db.delete(s.categories).where(eq(s.categories.id, id))
  })

  // ── Custom Fields ──────────────────────────────────────────

  ipcMain.handle('custom-fields:list', async () => {
    const { db, s } = getDataDb()
    return db.select().from(s.customFields).orderBy(asc(s.customFields.name))
  })

  ipcMain.handle(
    'custom-fields:create',
    async (_e, data: { name: string; field_type: string; options: string }) => {
      const { db, s } = getDataDb()
      const [result] = await db
        .insert(s.customFields)
        .values({ name: data.name, field_type: data.field_type, options: data.options })
        .returning()
      return result
    }
  )

  ipcMain.handle('custom-fields:delete', async (_e, id: number) => {
    const { db, s } = getDataDb()
    await db.delete(s.customFieldValues).where(eq(s.customFieldValues.field_id, id))
    await db.delete(s.customFields).where(eq(s.customFields.id, id))
  })

  ipcMain.handle('custom-fields:get-values', async (_e, itemId: number) => {
    const { db, s } = getDataDb()
    return db
      .select({
        field_id: s.customFieldValues.field_id,
        value: s.customFieldValues.value,
        name: s.customFields.name,
        field_type: s.customFields.field_type
      })
      .from(s.customFieldValues)
      .innerJoin(s.customFields, eq(s.customFields.id, s.customFieldValues.field_id))
      .where(eq(s.customFieldValues.item_id, itemId))
  })

  ipcMain.handle(
    'custom-fields:set-value',
    async (_e, itemId: number, fieldId: number, value: string) => {
      const { db, s } = getDataDb()
      await db
        .insert(s.customFieldValues)
        .values({ item_id: itemId, field_id: fieldId, value })
        .onConflictDoUpdate({
          target: [s.customFieldValues.item_id, s.customFieldValues.field_id],
          set: { value }
        })
    }
  )

  // ── Overdue Checkouts ──────────────────────────────────────

  ipcMain.handle('checkouts:overdue', async () => {
    const { db, s } = getDataDb()
    const now = new Date().toISOString()
    const checkoutCols = getTableColumns(s.checkouts)
    return db
      .select({
        ...checkoutCols,
        item_name: s.items.name,
        item_barcode: s.items.barcode
      })
      .from(s.checkouts)
      .innerJoin(s.items, eq(s.items.id, s.checkouts.item_id))
      .where(
        and(
          isNull(s.checkouts.checked_in_at),
          isNotNull(s.checkouts.due_date),
          sql`${s.checkouts.due_date} < ${now}`
        )
      )
      .orderBy(asc(s.checkouts.due_date))
  })

  ipcMain.handle('checkouts:overdue-count', async () => {
    const { db, s } = getDataDb()
    const now = new Date().toISOString()
    const [row] = await db
      .select({ c: count() })
      .from(s.checkouts)
      .where(
        and(
          isNull(s.checkouts.checked_in_at),
          isNotNull(s.checkouts.due_date),
          sql`${s.checkouts.due_date} < ${now}`
        )
      )
    return Number(row?.c) ?? 0
  })

  // ── Checkout Stats ─────────────────────────────────────────

  ipcMain.handle('checkouts:stats', async () => {
    const { db, s } = getDataDb()
    const now = new Date().toISOString()

    const [totalActive] = await db
      .select({ c: count() })
      .from(s.checkouts)
      .where(isNull(s.checkouts.checked_in_at))

    const [totalOverdue] = await db
      .select({ c: count() })
      .from(s.checkouts)
      .where(
        and(
          isNull(s.checkouts.checked_in_at),
          isNotNull(s.checkouts.due_date),
          sql`${s.checkouts.due_date} < ${now}`
        )
      )

    const topCheckedOut = await db
      .select({ name: s.items.name, cnt: count() })
      .from(s.checkouts)
      .innerJoin(s.items, eq(s.items.id, s.checkouts.item_id))
      .groupBy(s.checkouts.item_id, s.items.name)
      .orderBy(desc(count()))
      .limit(5)

    const topUsers = await db
      .select({ name: s.checkouts.checked_out_to, cnt: count() })
      .from(s.checkouts)
      .groupBy(s.checkouts.checked_out_to)
      .orderBy(desc(count()))
      .limit(5)

    // Average checkout duration — computed in JS for cross-dialect compatibility
    const completed = await db
      .select({
        checked_out_at: s.checkouts.checked_out_at,
        checked_in_at: s.checkouts.checked_in_at
      })
      .from(s.checkouts)
      .where(isNotNull(s.checkouts.checked_in_at))

    let avgDays = 0
    if (completed.length > 0) {
      const totalDays = completed.reduce((sum, c) => {
        const outDate = new Date(c.checked_out_at).getTime()
        const inDate = new Date(c.checked_in_at!).getTime()
        return sum + (inDate - outDate) / (1000 * 60 * 60 * 24)
      }, 0)
      avgDays = Math.round((totalDays / completed.length) * 10) / 10
    }

    return {
      activeCount: Number(totalActive?.c) ?? 0,
      overdueCount: Number(totalOverdue?.c) ?? 0,
      topCheckedOut: topCheckedOut.map((r) => ({ name: r.name, cnt: Number(r.cnt) })),
      topUsers: topUsers.map((r) => ({ name: r.name, cnt: Number(r.cnt) })),
      avgDurationDays: avgDays
    }
  })

  // ── Dashboard Stats ────────────────────────────────────────

  ipcMain.handle('dashboard:stats', async () => {
    const { db, s } = getDataDb()

    const [totalItems] = await db
      .select({ c: count() })
      .from(s.items)
      .where(isNull(s.items.deleted_at))

    const [totalUnits] = await db
      .select({ s: sql<string>`COALESCE(SUM(${s.items.quantity}), 0)` })
      .from(s.items)
      .where(isNull(s.items.deleted_at))

    const [totalValue] = await db
      .select({
        v: sql<string>`COALESCE(SUM(${s.items.retail_value} * ${s.items.quantity}), 0)`
      })
      .from(s.items)
      .where(isNull(s.items.deleted_at))

    const categoryBreakdown = await db
      .select({
        name: sql<string>`CASE WHEN ${s.items.category} = '' THEN 'Uncategorized' ELSE ${s.items.category} END`,
        count: count()
      })
      .from(s.items)
      .where(isNull(s.items.deleted_at))
      .groupBy(s.items.category)
      .orderBy(desc(count()))

    return {
      totalItems: Number(totalItems?.c) ?? 0,
      totalUnits: Number(totalUnits?.s) || 0,
      totalValue: Number(totalValue?.v) || 0,
      categoryBreakdown: categoryBreakdown.map((r) => ({
        name: r.name,
        count: Number(r.count)
      }))
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
        host: string
        port: number
        database: string
        user: string
        password: string
      }
    ): Promise<{ ok: boolean; error?: string }> => {
      const testPool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionTimeoutMillis: 5000
      })
      try {
        const client = await testPool.connect()
        await client.query('SELECT 1')
        client.release()
        await testPool.end()
        return { ok: true }
      } catch (err: unknown) {
        try {
          await testPool.end()
        } catch {
          /* ignore cleanup errors */
        }
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'remote-db:save',
    async (
      _e,
      config: {
        host: string
        port: number
        database: string
        user: string
        password: string
      }
    ) => {
      rawDb
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('remoteDbConfig', ?)")
        .run(JSON.stringify(config))
      await connectRemote(config)
      rawDb
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dbMode', 'remote')")
        .run()
    }
  )

  ipcMain.handle('remote-db:disconnect', async () => {
    await disconnectRemote()
    rawDb.prepare("DELETE FROM settings WHERE key = 'remoteDbConfig'").run()
    rawDb
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dbMode', 'local')")
      .run()
  })

  ipcMain.handle('remote-db:get-mode', () => {
    return getMode()
  })

  ipcMain.handle('remote-db:get-config', () => {
    const row = rawDb
      .prepare("SELECT value FROM settings WHERE key = 'remoteDbConfig'")
      .get() as { value: string } | undefined
    if (!row) return null
    return JSON.parse(row.value)
  })
}
