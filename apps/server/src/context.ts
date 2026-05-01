export type Context = {
  headers: Headers
  waitUntil: (promise: Promise<unknown>) => void
}
