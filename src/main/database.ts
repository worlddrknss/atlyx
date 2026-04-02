import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'atlyx.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'Warehouse',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      item_name TEXT NOT NULL DEFAULT '',
      barcode TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  seedIfEmpty()
}

function seedIfEmpty(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }
  if (count.c > 0) return

  const insertItem = db.prepare(
    'INSERT INTO items (name, barcode, category, quantity, location) VALUES (?, ?, ?, ?, ?)'
  )
  const insertLocation = db.prepare(
    'INSERT INTO locations (name, type, description) VALUES (?, ?, ?)'
  )

  const tx = db.transaction(() => {
    insertLocation.run('Warehouse A', 'Warehouse', 'Main storage facility — electronics & accessories')
    insertLocation.run('Warehouse B', 'Warehouse', 'Secondary storage — furniture & bulk items')
    insertLocation.run('Office', 'Office', 'On-site office supplies and equipment')

    insertItem.run('Wireless Mouse', '4901234567890', 'Electronics', 24, 'Warehouse A')
    insertItem.run('USB-C Hub', '0012345678905', 'Electronics', 8, 'Warehouse A')
    insertItem.run('Mechanical Keyboard', '5901234123457', 'Electronics', 42, 'Warehouse B')
  })
  tx()
}

export function getDatabase(): Database.Database {
  return db
}
