export type DebugLogger = {
  log: (scope: string, message: string, details?: Record<string, unknown>) => void
  request: (request: Request, extra?: Record<string, unknown>) => void
  response: (request: Request, status: number, extra?: Record<string, unknown>) => void
}

export function createDebugLogger(enabled: boolean): DebugLogger {
  function log(scope: string, message: string, details?: Record<string, unknown>): void {
    if (!enabled) return
    const timestamp = new Date().toISOString()
    const suffix = details ? ` ${JSON.stringify(sanitizeDebugValue(details))}` : ''
    console.log(`[${timestamp}] [remote:${scope}] ${message}${suffix}`)
  }

  return {
    log,
    request(request, extra) {
      log('http', 'request', {
        method: request.method,
        path: new URL(request.url).pathname,
        hasAuthorization: Boolean(request.headers.get('authorization')),
        ...extra,
      })
    },
    response(request, status, extra) {
      log('http', 'response', {
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        ...extra,
      })
    },
  }
}

function sanitizeDebugValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDebugValue(item))
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  const redacted = new Set([
    'authorization',
    'Authorization',
    'secret',
    'token',
    'session_ingress_token',
    'sessionIngressToken',
    'environment_secret',
    'environmentSecret',
  ])

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (redacted.has(key)) {
        return [key, redactSecret(entry)]
      }
      return [key, sanitizeDebugValue(entry)]
    }),
  )
}

function redactSecret(value: unknown): string {
  if (typeof value !== 'string' || !value) return '[redacted]'
  if (value.length <= 8) return '[redacted]'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
