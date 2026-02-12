import { env } from '@ig/env/web'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const serverUrl = new URL(env.VITE_SERVER_URL)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
