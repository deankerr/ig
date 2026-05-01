import type { server } from '@ig/infra/alchemy.run'

export type ServerEnv = Omit<typeof server.Env, 'INFERENCE_DO'> & {
  INFERENCE_DO: DurableObjectNamespace
}
