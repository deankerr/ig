import { relations } from 'drizzle-orm'
import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core'

// -- Tables --

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

export const tags = sqliteTable(
  'tags',
  {
    tag: text('tag').notNull(),
    value: text('value'),
    targetId: text('target_id')
      .notNull()
      .references(() => artifacts.id),
  },
  (table) => [
    primaryKey({ columns: [table.tag, table.targetId] }),
    index('idx_tags_target').on(table.targetId),
    index('idx_tags_tag').on(table.tag),
    index('idx_tags_tag_value').on(table.tag, table.value),
  ],
)

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

// -- Relations --

export const generationsRelations = relations(generations, ({ many }) => ({
  artifacts: many(artifacts),
}))

export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  generation: one(generations, {
    fields: [artifacts.generationId],
    references: [generations.id],
  }),
  tags: many(tags),
}))

export const tagsRelations = relations(tags, ({ one }) => ({
  artifact: one(artifacts, {
    fields: [tags.targetId],
    references: [artifacts.id],
  }),
}))
