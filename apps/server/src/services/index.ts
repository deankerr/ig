import { resolveAutoAspectRatio } from './auto-aspect-ratio'

export function createServices(env: Env) {
  return {
    autoAspectRatio: (prompt: string) => resolveAutoAspectRatio(prompt, env.AI),
  }
}

export type Services = ReturnType<typeof createServices>

export type { AspectRatio, AutoAspectRatioData, AutoAspectRatioResult } from './auto-aspect-ratio'
