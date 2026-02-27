// Shared Zod validators.

import { z } from 'zod'

/** http(s) URL with a domain hostname (no IPs, no localhost). */
export const zDomainUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain })
