// Centralized localStorage access.
// All keys and typed read/write functions live here.

const KEYS = {
  apiKey: 'ig-api-key',
  benchInput: 'craft-bench-input',
  displayMode: 'ig-display-mode',
} as const

// API key

export function getApiKey() {
  return localStorage.getItem(KEYS.apiKey)
}

export function setApiKey(key: string) {
  localStorage.setItem(KEYS.apiKey, key)
}

export function clearApiKey() {
  localStorage.removeItem(KEYS.apiKey)
}

// Bench input

export function getBenchInput() {
  return localStorage.getItem(KEYS.benchInput) ?? ''
}

export function setBenchInput(input: string) {
  localStorage.setItem(KEYS.benchInput, input)
}

// Display mode

export type DisplayMode = 'grid' | 'list'

export function getDisplayMode(): DisplayMode {
  return (localStorage.getItem(KEYS.displayMode) as DisplayMode) ?? 'grid'
}

export function setDisplayMode(mode: DisplayMode) {
  localStorage.setItem(KEYS.displayMode, mode)
}
