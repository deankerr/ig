import { relations } from 'drizzle-orm'
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

export const generations = sqliteTable(
  'generations',
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
    index('idx_gen_created').on(table.createdAt),
    index('idx_gen_model_created').on(table.model, table.createdAt),
  ],
)

export type Generation = typeof generations.$inferSelect
export type NewGeneration = typeof generations.$inferInsert

export const artifacts = sqliteTable(
  'artifacts',
  {
    id: text('id').primaryKey(),
    generationId: text('generation_id')
      .notNull()
      .references(() => generations.id),
    model: text('model').notNull(),
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    seed: integer('seed'),
    cost: real('cost'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_art_created').on(table.createdAt),
    index('idx_art_generation').on(table.generationId),
    index('idx_art_model_created').on(table.model, table.createdAt),
  ],
)

export type Artifact = typeof artifacts.$inferSelect
export type NewArtifact = typeof artifacts.$inferInsert

// -- Relations --

export const generationsRelations = relations(generations, ({ many }) => ({
  artifacts: many(artifacts),
}))

// artifactsRelations is defined in tags.ts to avoid circular imports
// (tags table references artifacts, and the relation needs to reference tags)
