import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers"
import * as R from "remeda"

import {
  fetchAllModels,
  upsertModels,
  queryModelsNeedingPricing,
  fetchPricingBatch,
  PRICING_BATCH_SIZE,
  type SyncParams,
} from "./service"

export class ModelSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const params = event.payload ?? {}
    const env = this.env

    const falModels = await step.do("fetch-models", async () => {
      return fetchAllModels(env.FAL_KEY)
    })

    await step.do("upsert-models", async () => {
      return upsertModels(falModels)
    })

    const needsPricing = await step.do("query-needs-pricing", async () => {
      return queryModelsNeedingPricing(params)
    })

    // Fetch pricing in batches - each batch is a retriable step
    let totalUpdated = 0
    let totalErrors = 0
    const chunks = R.chunk(needsPricing, PRICING_BATCH_SIZE)

    for (const [i, chunk] of chunks.entries()) {
      const result = await step.do(`fetch-pricing-${i}`, async () => {
        return fetchPricingBatch(chunk, env.FAL_KEY)
      })
      totalUpdated += result.updated
      totalErrors += result.errors
    }

    return {
      found: falModels.length,
      pricingProcessed: needsPricing.length,
      pricingUpdated: totalUpdated,
      pricingErrors: totalErrors,
    }
  }
}
