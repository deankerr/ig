import { Hono } from 'hono'

import { ephemeralError } from './discord-api'
import { handleInteraction } from './handle-interaction'

const app = new Hono<{ Bindings: Env }>()

app.onError((error, c) => {
  if (c.req.path === '/discord/interactions' && c.req.method === 'POST') {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return c.json(ephemeralError(message))
  }

  return c.text('internal error', 500)
})

app.get('/', (c) => c.text('discord-bot'))
app.post('/discord/interactions', handleInteraction)

export default {
  fetch: app.fetch,
}
