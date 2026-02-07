import type { AppRouterClient } from 'server/src/routers'

/** A generation record as returned by the API. */
export type Generation = NonNullable<Awaited<ReturnType<AppRouterClient['generations']['get']>>>
