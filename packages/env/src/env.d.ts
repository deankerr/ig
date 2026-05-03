import type { server } from '@ig/infra/alchemy.run'

export type ServerEnv = Omit<typeof server.Env, 'INFERENCE_DO'> & {
  GENERATION_EVENTS: Queue<unknown>
  INFERENCE_DO: DurableObjectNamespace
}
