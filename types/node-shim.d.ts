declare module 'fs' {
  export function existsSync(path: string): boolean
}

declare module 'path' {
  export function resolve(...paths: string[]): string
  export function relative(from: string, to: string): string
}

declare const process: {
  cwd(): string
  exit(code?: number): void
  exitCode?: number
}

type ActiveXObject = any

interface ImportMeta {
  env?: Record<string, string | undefined>
}
