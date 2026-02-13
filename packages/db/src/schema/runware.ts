import { relations } from 'drizzle-orm'
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

export const runwareGenerations = sqliteTable(
  'runware_generations',
  {
    id: text('id').primaryKey(),
    model: text('model').notNull(),
    input: text('input', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    batch: integer('batch').notNull(),
    error: text('error'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_rg_created').on(table.createdAt),
    index('idx_rg_model_created').on(table.model, table.createdAt),
  ],
)

export type RunwareGeneration = typeof runwareGenerations.$inferSelect
export type NewRunwareGeneration = typeof runwareGenerations.$inferInsert

export const runwareArtifacts = sqliteTable(
  'runware_artifacts',
  {
    id: text('id').primaryKey(),
    generationId: text('generation_id')
      .notNull()
      .references(() => runwareGenerations.id),
    model: text('model').notNull(),
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    seed: integer('seed'),
    cost: real('cost'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_ra_created').on(table.createdAt),
    index('idx_ra_generation').on(table.generationId),
    index('idx_ra_model_created').on(table.model, table.createdAt),
  ],
)

export type RunwareArtifact = typeof runwareArtifacts.$inferSelect
export type NewRunwareArtifact = typeof runwareArtifacts.$inferInsert

// -- Relations --

export const runwareGenerationsRelations = relations(runwareGenerations, ({ many }) => ({
  artifacts: many(runwareArtifacts),
}))

// runwareArtifactsRelations is defined in tags.ts to avoid circular imports
// (tags table references runwareArtifacts, and the relation needs to reference tags)
