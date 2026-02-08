import { env } from '@ig/env/web'

export const serverUrl = new URL(env.VITE_SERVER_URL)
