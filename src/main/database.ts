import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { app } from 'electron'
import { join } from 'path'
import * as sqliteSchema from './schema/sqlite'
import * as pgSchema from './schema/pg'

// Raw SQLite connection — always active for settings
let rawDb: Database.Database

// Drizzle instances
let sqliteDrizzle: BetterSQLite3Database
let pgDrizzle: NodePgDatabase | null = null
let pgPool: Pool | null = null

// Current mode
let currentMode: 'local' | 'remote' = 'local'

export async function initDatabase(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'atlyx.db')
  rawDb = new Database(dbPath)
  rawDb.pragma('journal_mode = WAL')
  rawDb.pragma('foreign_keys = ON')

  // Settings table always lives in local SQLite
  rawDb.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`)

  // Create data tables in local SQLite
  createSqliteTables()

  // Initialize Drizzle for SQLite
  sqliteDrizzle = drizzleSqlite(rawDb)

  // Seed with sample data if empty
  seedIfEmpty()

  // Auto-reconnect to remote if previously configured
  const modeRow = rawDb.prepare("SELECT value FROM settings WHERE key = 'dbMode'").get() as
    | { value: string }
    | undefined
  if (modeRow?.value === 'remote') {
    const configRow = rawDb
      .prepare("SELECT value FROM settings WHERE key = 'remoteDbConfig'")
      .get() as { value: string } | undefined
    if (configRow) {
      try {
        const config = JSON.parse(configRow.value)
        await connectRemote(config)
      } catch {
        // Remote unavailable — fall back to local
        currentMode = 'local'
      }
    }
  }
}

function createSqliteTables(): void {
  rawDb.exec(`
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
      min_quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'Warehouse',
      description TEXT NOT NULL DEFAULT '',
      parent_id INTEGER REFERENCES locations(id),
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

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value TEXT NOT NULL DEFAULT '',
      UNIQUE(item_id, field_id)
    );
  `)

  // Run SQLite-specific migrations for older databases
  const cols = rawDb.prepare("PRAGMA table_info('items')").all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'serial_number')) {
    rawDb.exec("ALTER TABLE items ADD COLUMN serial_number TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'make')) {
    rawDb.exec("ALTER TABLE items ADD COLUMN make TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'model')) {
    rawDb.exec("ALTER TABLE items ADD COLUMN model TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.some((c) => c.name === 'retail_value')) {
    rawDb.exec('ALTER TABLE items ADD COLUMN retail_value REAL NOT NULL DEFAULT 0')
  }
  if (!cols.some((c) => c.name === 'min_quantity')) {
    rawDb.exec('ALTER TABLE items ADD COLUMN min_quantity INTEGER NOT NULL DEFAULT 0')
  }
  if (!cols.some((c) => c.name === 'deleted_at')) {
    rawDb.exec('ALTER TABLE items ADD COLUMN deleted_at TEXT')
  }
  const locCols = rawDb.prepare("PRAGMA table_info('locations')").all() as Array<{ name: string }>
  if (!locCols.some((c) => c.name === 'parent_id')) {
    rawDb.exec('ALTER TABLE locations ADD COLUMN parent_id INTEGER REFERENCES locations(id)')
  }
}

async function createPgTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      make TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      barcode TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      retail_value REAL NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'Warehouse',
      description TEXT NOT NULL DEFAULT '',
      parent_id INTEGER REFERENCES locations(id),
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS activity (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      item_name TEXT NOT NULL DEFAULT '',
      barcode TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS checkouts (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      checked_out_to TEXT NOT NULL,
      checked_out_by TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      checked_out_at TEXT NOT NULL DEFAULT '',
      checked_in_at TEXT,
      checked_in_by TEXT,
      condition_out TEXT NOT NULL DEFAULT 'Good',
      condition_in TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value TEXT NOT NULL DEFAULT '',
      UNIQUE(item_id, field_id)
    );
  `)
}

function seedIfEmpty(): void {
  const count = rawDb.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }
  if (count.c > 0) return

  const insertItem = rawDb.prepare(
    'INSERT INTO items (name, barcode, category, quantity, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const insertLocation = rawDb.prepare(
    'INSERT INTO locations (name, type, description, created_at) VALUES (?, ?, ?, ?)'
  )

  const now = new Date().toISOString()
  const tx = rawDb.transaction(() => {
    insertLocation.run(
      'Warehouse A',
      'Warehouse',
      'Main storage facility — electronics & accessories',
      now
    )
    insertLocation.run(
      'Warehouse B',
      'Warehouse',
      'Secondary storage — furniture & bulk items',
      now
    )
    insertLocation.run('Office', 'Office', 'On-site office supplies and equipment', now)

    insertItem.run('Wireless Mouse', '4901234567890', 'Electronics', 24, 'Warehouse A', now, now)
    insertItem.run('USB-C Hub', '0012345678905', 'Electronics', 8, 'Warehouse A', now, now)
    insertItem.run(
      'Mechanical Keyboard',
      '5901234123457',
      'Electronics',
      42,
      'Warehouse B',
      now,
      now
    )
  })
  tx()
}

// ── Connection management ────────────────────────────────────

export async function connectRemote(config: {
  host: string
  port: number
  database: string
  user: string
  password: string
}): Promise<void> {
  pgPool = new Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: 5000
  })

  // Verify connection works
  const client = await pgPool.connect()
  client.release()

  // Create tables if they don't exist
  await createPgTables(pgPool)

  pgDrizzle = drizzlePg(pgPool)
  currentMode = 'remote'
}

export async function disconnectRemote(): Promise<void> {
  if (pgPool) {
    await pgPool.end()
    pgPool = null
    pgDrizzle = null
  }
  currentMode = 'local'
}

// ── Accessors ────────────────────────────────────────────────

/** Raw SQLite DB — always available, used for settings */
export function getRawDb(): Database.Database {
  return rawDb
}

export function getMode(): 'local' | 'remote' {
  return currentMode
}

/**
 * Returns the active Drizzle instance and matching schema for data operations.
 * Settings operations should use getRawDb() directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDataDb(): { db: any; s: typeof sqliteSchema } {
  if (currentMode === 'remote' && pgDrizzle) {
    return { db: pgDrizzle, s: pgSchema as unknown as typeof sqliteSchema }
  }
  return { db: sqliteDrizzle, s: sqliteSchema }
}
