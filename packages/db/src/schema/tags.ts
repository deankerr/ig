import { relations } from 'drizzle-orm'
import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core'

import { runwareArtifacts, runwareGenerations } from './runware'

export const tags = sqliteTable(
  'tags',
  {
    tag: text('tag').notNull(),
    value: text('value'),
    targetId: text('target_id')
      .notNull()
      .references(() => runwareArtifacts.id),
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

export const tagsRelations = relations(tags, ({ one }) => ({
  artifact: one(runwareArtifacts, {
    fields: [tags.targetId],
    references: [runwareArtifacts.id],
  }),
}))

// Defined here (not runware.ts) to avoid circular imports
export const runwareArtifactsRelations = relations(runwareArtifacts, ({ one, many }) => ({
  generation: one(runwareGenerations, {
    fields: [runwareArtifacts.generationId],
    references: [runwareGenerations.id],
  }),
  tags: many(tags),
}))
