/// <reference path="./env.d.ts" />
import { env as cloudflareEnv } from 'cloudflare:workers'

import type { ServerEnv } from './env'

export type { ServerEnv } from './env'

export const env = cloudflareEnv as unknown as ServerEnv
