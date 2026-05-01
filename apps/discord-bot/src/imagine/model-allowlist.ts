export type AllowedModel = {
  air: string
  label: string
}

export function parseModelAllowlist(value: string): AllowedModel[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.lastIndexOf('|')

      if (separatorIndex === -1) {
        return { air: item, label: item }
      }

      const label = item.slice(0, separatorIndex).trim()
      const air = item.slice(separatorIndex + 1).trim()

      return {
        air,
        label: label || air,
      }
    })
    .filter((item) => item.air)
}
