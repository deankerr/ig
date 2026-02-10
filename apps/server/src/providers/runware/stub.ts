import type { Context } from '@/context'

import type { GenerationError } from './errors'
import type {
  ConfirmResult,
  GenerationState,
  InitArgs,
  OutputResult,
  RecordWebhookResult,
} from './types'

/** RPC interface for GenerationDO. Typed separately because CF's Rpc.Provider
 *  collapses sync DO methods to `never`. This defines the actual RPC contract. */
type GenerationStub = {
  init(args: InitArgs): Promise<void>
  recordWebhook(payload: unknown): Promise<RecordWebhookResult>
  confirmOutputs(results: OutputResult[]): Promise<ConfirmResult>
  setError(error: GenerationError): Promise<void>
  getState(): Promise<GenerationState | null>
}

export function getGenerationStub(ctx: Context, id: string) {
  const ns = ctx.env.GENERATION_DO
  return ns.get(ns.idFromName(id)) as unknown as GenerationStub
}
