// oxlint-disable no-unused-vars
// not currently used, in case we want it

const SLUG_PREFIX_LENGTH = 12

function makeSlug(id: string, slugArg?: string) {
  return slugArg ? `${id.slice(0, SLUG_PREFIX_LENGTH)}-${slugArg}` : null
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s_/-]/g, '') // keep only allowed chars
    .trim()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .slice(0, 100)
}
