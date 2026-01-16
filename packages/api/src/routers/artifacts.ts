import { fal } from "@fal-ai/client";
import { db } from "@ig/db";
import { artifacts } from "@ig/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { publicProcedure } from "../index";
import {
  createArtifactInputSchema,
  deleteArtifactInputSchema,
  getArtifactInputSchema,
  listArtifactsQuerySchema,
  retryArtifactInputSchema,
  updateTagsInputSchema,
} from "../schemas/artifacts";

export const artifactsRouter = {
  create: publicProcedure.input(createArtifactInputSchema).handler(async ({ input, context }) => {
    const id = uuidv7();

    // Insert artifact with creating status
    await db.insert(artifacts).values({
      id,
      status: "creating",
      endpoint: input.endpoint,
      input: input.input,
      tags: input.tags,
    });

    // Configure fal client with API key
    fal.config({ credentials: context.env.FAL_KEY });

    // Submit to fal.ai queue with webhook URL
    const webhookUrl = `${context.env.WEBHOOK_URL}?artifact_id=${id}`;
    const result = await fal.queue.submit(input.endpoint, {
      input: input.input,
      webhookUrl,
    });

    // Update artifact with fal request ID
    await db
      .update(artifacts)
      .set({ falRequestId: result.request_id })
      .where(eq(artifacts.id, id));

    console.log('artifact_created', { id, endpoint: input.endpoint, requestId: result.request_id });
    return { id, requestId: result.request_id };
  }),

  list: publicProcedure.input(listArtifactsQuerySchema).handler(async ({ input }) => {
    const conditions = [];

    if (input.status) {
      conditions.push(eq(artifacts.status, input.status));
    }

    if (input.endpoint) {
      conditions.push(eq(artifacts.endpoint, input.endpoint));
    }

    if (input.cursor) {
      // Cursor is the createdAt timestamp in ISO format
      const cursorDate = new Date(input.cursor);
      conditions.push(lt(artifacts.createdAt, cursorDate));
    }

    const results = await db
      .select()
      .from(artifacts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(artifacts.createdAt))
      .limit(input.limit + 1); // Fetch one extra to determine if there's a next page

    // Filter by tags in-memory if specified
    let filtered = results;
    if (input.tags && input.tags.length > 0) {
      filtered = results.filter((artifact) => {
        const artifactTags = artifact.tags;
        return input.tags!.every((tag) => artifactTags.includes(tag));
      });
    }

    const hasMore = filtered.length > input.limit;
    const items = hasMore ? filtered.slice(0, input.limit) : filtered;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return {
      items,
      nextCursor,
    };
  }),

  get: publicProcedure.input(getArtifactInputSchema).handler(async ({ input }) => {
    const result = await db.select().from(artifacts).where(eq(artifacts.id, input.id)).limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }),

  updateTags: publicProcedure.input(updateTagsInputSchema).handler(async ({ input }) => {
    const existing = await db
      .select({ tags: artifacts.tags })
      .from(artifacts)
      .where(eq(artifacts.id, input.id))
      .limit(1);

    const artifact = existing[0];
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const currentTags = artifact.tags;

    // Remove specified tags, then add new ones
    const withoutRemoved = currentTags.filter((tag: string) => !input.remove.includes(tag));
    const newTags = [...new Set([...withoutRemoved, ...input.add])];

    await db.update(artifacts).set({ tags: newTags }).where(eq(artifacts.id, input.id));

    return { id: input.id, tags: newTags };
  }),

  delete: publicProcedure.input(deleteArtifactInputSchema).handler(async ({ input, context }) => {
    const existing = await db.select().from(artifacts).where(eq(artifacts.id, input.id)).limit(1);

    const artifact = existing[0];
    if (!artifact) {
      return { deleted: false };
    }

    // Delete from R2 if there's an output
    if (artifact.outputUrl) {
      const key = `artifacts/${input.id}`;
      await context.env.ARTIFACTS_BUCKET.delete(key);
    }

    // Delete from database
    await db.delete(artifacts).where(eq(artifacts.id, input.id));

    console.log('artifact_deleted', { id: input.id });
    return { deleted: true };
  }),

  listTags: publicProcedure.handler(async () => {
    const results = await db.select({ tags: artifacts.tags }).from(artifacts);

    // Aggregate all unique tags
    const tagSet = new Set<string>();
    for (const row of results) {
      for (const tag of row.tags) {
        tagSet.add(tag);
      }
    }

    return { tags: [...tagSet].sort() };
  }),

  retry: publicProcedure.input(retryArtifactInputSchema).handler(async ({ input, context }) => {
    const existing = await db.select().from(artifacts).where(eq(artifacts.id, input.id)).limit(1);

    const original = existing[0];
    if (!original) {
      throw new Error("Artifact not found");
    }

    const id = uuidv7();

    // Create new artifact with same input
    await db.insert(artifacts).values({
      id,
      status: "creating",
      endpoint: original.endpoint,
      input: original.input,
      tags: input.tags ?? original.tags,
    });

    // Configure fal client and submit
    fal.config({ credentials: context.env.FAL_KEY });

    const webhookUrl = `${context.env.WEBHOOK_URL}?artifact_id=${id}`;
    const result = await fal.queue.submit(original.endpoint, {
      input: original.input,
      webhookUrl,
    });

    // Update with fal request ID
    await db
      .update(artifacts)
      .set({ falRequestId: result.request_id })
      .where(eq(artifacts.id, id));

    console.log('artifact_retried', { id, originalId: input.id, endpoint: original.endpoint, requestId: result.request_id });
    return { id, requestId: result.request_id, originalId: input.id };
  }),
};
