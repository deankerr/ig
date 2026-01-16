import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(), // UUIDv7
    status: text("status", { enum: ["creating", "ready", "failed"] }).notNull(),
    endpoint: text("endpoint").notNull(), // fal-ai/flux/schnell
    input: text("input", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    tags: text("tags", { mode: "json" }).notNull().default([]).$type<string[]>(),
    outputUrl: text("output_url"),
    contentType: text("content_type"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    falRequestId: text("fal_request_id"),
    falMetrics: text("fal_metrics", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_artifacts_created").on(table.createdAt),
    index("idx_artifacts_status_created").on(table.status, table.createdAt),
    index("idx_artifacts_fal_request_id").on(table.falRequestId),
  ],
);

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;
