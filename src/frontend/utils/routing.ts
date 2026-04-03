import type { RouteState } from '../types'

export function readRoute(): RouteState {
  const hash = location.hash.replace(/^#/, '')
  if (!hash.startsWith('session=')) {
    return { kind: 'overview' }
  }

  return {
    kind: 'session',
    sessionId: decodeURIComponent(hash.slice('session='.length)),
  }
}

export function openSession(sessionId: string) {
  location.hash = `session=${encodeURIComponent(sessionId)}`
}

export function openOverview() {
  location.hash = ''
}
