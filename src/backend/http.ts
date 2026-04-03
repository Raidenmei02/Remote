export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function sseHeaders(): HeadersInit {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  }
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  const text = await request.text()
  if (!text.trim()) return null
  return JSON.parse(text) as T
}

export function now(): string {
  return new Date().toISOString()
}

export function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}
