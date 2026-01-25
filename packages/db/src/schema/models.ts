import { sql } from "drizzle-orm"
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"

export const models = sqliteTable(
  "models",
  {
    endpointId: text("endpoint_id").primaryKey(),
    displayName: text("display_name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    status: text("status").notNull(),
    tags: text("tags", { mode: "json" }).notNull().default([]).$type<string[]>(),
    licenseType: text("license_type"),
    kind: text("kind").notNull(),
    durationEstimate: integer("duration_estimate"),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailAnimatedUrl: text("thumbnail_animated_url"),
    modelUrl: text("model_url").notNull(),
    githubUrl: text("github_url"),
    isFavorited: integer("is_favorited", { mode: "boolean" }),
    upstreamCreatedAt: integer("upstream_created_at", { mode: "timestamp_ms" }).notNull(),
    upstreamUpdatedAt: integer("upstream_updated_at", { mode: "timestamp_ms" }).notNull(),
    groupKey: text("group_key"),
    groupLabel: text("group_label"),
    // Pricing fields (nullable - fetched async)
    unitPrice: real("unit_price"),
    unit: text("unit"),
    currency: text("currency").default("USD"),
    // Sync state tracking
    modelSyncedAt: integer("model_synced_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    pricingSyncedAt: integer("pricing_synced_at", { mode: "timestamp_ms" }),
    syncError: text("sync_error"),
  },
  (table) => [
    index("idx_models_category").on(table.category),
    index("idx_models_status").on(table.status),
  ],
)

export type Model = typeof models.$inferSelect
export type NewModel = typeof models.$inferInsert
