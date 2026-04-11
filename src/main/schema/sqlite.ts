import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  make: text('make').notNull().default(''),
  model: text('model').notNull().default(''),
  barcode: text('barcode').notNull().unique(),
  category: text('category').notNull().default(''),
  serial_number: text('serial_number').notNull().default(''),
  quantity: integer('quantity').notNull().default(0),
  location: text('location').notNull().default(''),
  retail_value: real('retail_value').notNull().default(0),
  min_quantity: integer('min_quantity').notNull().default(0),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deleted_at: text('deleted_at')
})

export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  type: text('type').notNull().default('Warehouse'),
  description: text('description').notNull().default(''),
  parent_id: integer('parent_id'),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const activity = sqliteTable('activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  item_name: text('item_name').notNull().default(''),
  barcode: text('barcode').notNull().default(''),
  detail: text('detail').notNull().default(''),
  timestamp: text('timestamp').notNull().$defaultFn(() => new Date().toISOString())
})

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  barcode: text('barcode').notNull().unique(),
  notes: text('notes').notNull().default(''),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default('')
})

export const checkouts = sqliteTable('checkouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  item_id: integer('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  checked_out_to: text('checked_out_to').notNull(),
  checked_out_by: text('checked_out_by').notNull().default(''),
  department: text('department').notNull().default(''),
  notes: text('notes').notNull().default(''),
  due_date: text('due_date'),
  checked_out_at: text('checked_out_at').notNull().$defaultFn(() => new Date().toISOString()),
  checked_in_at: text('checked_in_at'),
  checked_in_by: text('checked_in_by'),
  condition_out: text('condition_out').notNull().default('Good'),
  condition_in: text('condition_in')
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6366f1'),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const customFields = sqliteTable('custom_fields', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  field_type: text('field_type').notNull().default('text'),
  options: text('options').notNull().default(''),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const customFieldValues = sqliteTable(
  'custom_field_values',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    item_id: integer('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    field_id: integer('field_id')
      .notNull()
      .references(() => customFields.id, { onDelete: 'cascade' }),
    value: text('value').notNull().default('')
  },
  (t) => [unique().on(t.item_id, t.field_id)]
)
