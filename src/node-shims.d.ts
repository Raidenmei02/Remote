declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
  platform: string
  pid: number
}

declare const Buffer: {
  from(input: string, encoding: 'utf8' | 'base64url'): {
    toString(encoding: 'utf8' | 'base64url'): string
  }
}

declare module 'crypto' {
  export function randomUUID(): string
}

declare module 'fs' {
  export function existsSync(path: string): boolean
  export type WriteStream = unknown
  export function createWriteStream(path: string, options?: { flags?: string }): WriteStream
}

declare module 'fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  export function readFile(path: string, encoding: string): Promise<string>
  export function writeFile(
    path: string,
    data: string,
    options?: { encoding?: string },
  ): Promise<void>
}

declare module 'path' {
  export function dirname(path: string): string
  export function join(...parts: string[]): string
}
