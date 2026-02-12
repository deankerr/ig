import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AppShell } from '@/components/app-shell'

const searchSchema = z.object({
  view: z.enum(['artifacts', 'generations']).catch('artifacts'),
  artifact: z.string().optional(),
  generation: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: AppShell,
})
