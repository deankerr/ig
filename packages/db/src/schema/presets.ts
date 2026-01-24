import { sql } from "drizzle-orm"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const presets = sqliteTable("presets", {
  name: text("name").primaryKey(), // e.g. "ig/cheap-model"
  description: text("description"),
  endpoint: text("endpoint").notNull(),
  input: text("input", { mode: "json" }).$type<Record<string, unknown>>(),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export type Preset = typeof presets.$inferSelect
export type NewPreset = typeof presets.$inferInsert
