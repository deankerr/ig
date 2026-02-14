export type Context = {
  env: Env
  headers: Headers
  waitUntil: (promise: Promise<unknown>) => void
}
