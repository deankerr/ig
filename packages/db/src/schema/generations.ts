import { sql } from "drizzle-orm"
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(), // UUIDv7
    status: text("status", { enum: ["pending", "ready", "failed"] }).notNull(),
    provider: text("provider").notNull().default("fal"),
    endpoint: text("endpoint").notNull(), // fal-ai/flux/schnell
    input: text("input", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    tags: text("tags", { mode: "json" }).notNull().default([]).$type<string[]>(),
    contentType: text("content_type"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    providerRequestId: text("provider_request_id"),
    providerMetadata: text("provider_metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    slug: text("slug").unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_generations_created").on(table.createdAt),
    index("idx_generations_status_created").on(table.status, table.createdAt),
    index("idx_generations_provider_request_id").on(table.providerRequestId),
    index("idx_generations_slug").on(table.slug),
  ],
)

export type Generation = typeof generations.$inferSelect
export type NewGeneration = typeof generations.$inferInsert
