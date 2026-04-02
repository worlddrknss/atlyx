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
      make TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      barcode TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      retail_value REAL NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS checkouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      checked_out_to TEXT NOT NULL,
      checked_out_by TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      checked_out_at TEXT NOT NULL DEFAULT (datetime('now')),
      checked_in_at TEXT,
      checked_in_by TEXT,
      condition_out TEXT NOT NULL DEFAULT 'Good',
      condition_in TEXT
    );
  `)

  runMigrations()
  seedIfEmpty()
}

function runMigrations(): void {
  const cols = db.prepare("PRAGMA table_info('items')").all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'serial_number')) {
    db.exec("ALTER TABLE items ADD COLUMN serial_number TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'make')) {
    db.exec("ALTER TABLE items ADD COLUMN make TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'model')) {
    db.exec("ALTER TABLE items ADD COLUMN model TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'retail_value')) {
    db.exec('ALTER TABLE items ADD COLUMN retail_value REAL NOT NULL DEFAULT 0')
  }
  if (!cols.some((c) => c.name === 'min_quantity')) {
    db.exec('ALTER TABLE items ADD COLUMN min_quantity INTEGER NOT NULL DEFAULT 0')
  }
  if (!cols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE items ADD COLUMN deleted_at TEXT')
  }

  // Locations: parent_id for hierarchy
  const locCols = db.prepare("PRAGMA table_info('locations')").all() as Array<{ name: string }>
  if (!locCols.some((c) => c.name === 'parent_id')) {
    db.exec('ALTER TABLE locations ADD COLUMN parent_id INTEGER REFERENCES locations(id)')
  }

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Custom fields table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Custom field values table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value TEXT NOT NULL DEFAULT '',
      UNIQUE(item_id, field_id)
    );
  `)
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
    insertLocation.run(
      'Warehouse A',
      'Warehouse',
      'Main storage facility — electronics & accessories'
    )
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
