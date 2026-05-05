import type { discordBot } from '@ig/infra/alchemy.run'
import { Hono } from 'hono'

import { createContext } from '../context'
import { buildImagineCommandDefinition } from '../interactions/imagine'
import { parseModelAllowlistText, saveModels, serializeModelAllowlistText } from '../models'

export const web = new Hono<{ Bindings: typeof discordBot.Env }>()
  .get('/bot-control', async (c) => {
    const ctx = await createContext(c.env)
    const modelsText = serializeModelAllowlistText(ctx.models.list)

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bot Control</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
</head>
<body>
  <main class="container">
    <h1>Bot Control</h1>

    <section>
      <h2>Model Allowlist</h2>
      <p>One entry per line: <code>air:model/id Label</code></p>
      <form method="POST" action="/models">
        <textarea name="models" rows="8">${modelsText}</textarea>
        <button type="submit">Save Models</button>
      </form>
    </section>

    <section>
      <h2>Register Discord Commands</h2>
      <p>Registers slash commands against the configured guild (<code>${c.env.DISCORD_GUILD_ID}</code>).</p>
      <form method="POST" action="/commands">
        <button type="submit">Register Commands</button>
      </form>
    </section>
  </main>
</body>
</html>`)
  })
  .post('/models', async (c) => {
    const body = await c.req.parseBody()
    const text = typeof body['models'] === 'string' ? body['models'] : ''
    const models = parseModelAllowlistText(text)

    await saveModels(c.env, models)

    console.log('[discord-bot:web] models updated', { count: models.length })

    return c.redirect('/bot-control')
  })
  .post('/commands', async (c) => {
    const ctx = await createContext(c.env)
    await ctx.discord.registerGuildCommands(c.env.DISCORD_GUILD_ID, [
      buildImagineCommandDefinition(ctx.models.choices),
    ])

    console.log('[discord-bot:web] commands registered', {
      guildId: c.env.DISCORD_GUILD_ID,
      modelCount: ctx.models.choices.length,
    })

    return c.redirect('/bot-control')
  })
