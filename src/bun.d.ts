declare namespace Bun {
  type Env = Record<string, string | undefined>

  const env: Env

  type ServeOptions = {
    port?: number
    fetch(request: Request, server: Server): Response | Promise<Response>
    websocket?: WebSocketHandler
  }

  type Server = {
    port: number
    hostname: string
    upgrade(
      request: Request,
      options?: {
        data?: unknown
        headers?: HeadersInit
      },
    ): boolean
  }

  type ServerWebSocket<T = unknown> = {
    data: T
    send(message: string): void
    close(code?: number, reason?: string): void
  }

  type WebSocketHandler<T = unknown> = {
    open?(ws: ServerWebSocket<T>): void | Promise<void>
    close?(ws: ServerWebSocket<T>, code?: number, reason?: string): void | Promise<void>
    message?(ws: ServerWebSocket<T>, message: string | ArrayBufferLike): void | Promise<void>
  }

  type BuildOptions = {
    entrypoints: string[]
    outdir: string
    target?: 'browser' | 'bun' | 'node'
    format?: 'esm' | 'cjs' | 'iife'
    minify?: boolean
    sourcemap?: 'none' | 'inline' | 'external'
  }

  type BuildResult = {
    success: boolean
    logs: Array<{ message: string }>
  }

  function serve(options: ServeOptions): Server
  function file(path: string): Blob
  function build(options: BuildOptions): Promise<BuildResult>
}

declare const Bun: {
  env: Bun.Env
  serve: typeof Bun.serve
  file: typeof Bun.file
  build: typeof Bun.build
}
