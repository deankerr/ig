/**
 * Formats an endpoint ID for display by removing the common fal-ai/ prefix.
 * Partner models without the prefix are returned unchanged.
 */
export function formatFalEndpointId(endpointId: string): string {
  return endpointId.replace(/^fal-ai\//, "")
}
