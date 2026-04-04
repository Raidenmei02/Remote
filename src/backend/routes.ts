import { assertSafeId } from '../shared/protocol'
import type { Route } from './types'

export function parseRoute(pathname: string): Route | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  if (segments[0] === 'v1' && segments[1] === 'environments') {
    if (segments.length === 2) {
      return { kind: 'environments_root' }
    }
    if (segments.length === 3 && segments[2] === 'bridge') {
      return { kind: 'register_environment' }
    }
    if (segments.length === 4 && segments[2] === 'bridge') {
      return {
        kind: 'delete_bridge_environment',
        environmentId: assertSafeId(segments[3], 'environmentId'),
      }
    }
    if (segments.length === 3) {
      return {
        kind: 'get_environment',
        environmentId: assertSafeId(segments[2], 'environmentId'),
      }
    }
    if (segments.length === 5 && segments[3] === 'work' && segments[4] === 'poll') {
      return {
        kind: 'poll_work',
        environmentId: assertSafeId(segments[2], 'environmentId'),
      }
    }
    if (segments.length === 6 && segments[3] === 'work') {
      const environmentId = assertSafeId(segments[2], 'environmentId')
      const workId = assertSafeId(segments[4], 'workId')
      if (segments[5] === 'ack') {
        return { kind: 'ack_work', environmentId, workId }
      }
      if (segments[5] === 'heartbeat') {
        return { kind: 'heartbeat_work', environmentId, workId }
      }
      if (segments[5] === 'stop') {
        return { kind: 'stop_work', environmentId, workId }
      }
    }
    if (segments.length === 5 && segments[3] === 'bridge' && segments[4] === 'reconnect') {
      return {
        kind: 'reconnect_session',
        environmentId: assertSafeId(segments[2], 'environmentId'),
      }
    }
  }

  if (segments[0] === 'v1' && segments[1] === 'sessions') {
    if (segments.length === 2) {
      return { kind: 'sessions_root' }
    }
    if (segments.length === 4 && segments[3] === 'archive') {
      return {
        kind: 'archive_session',
        sessionId: assertSafeId(segments[2], 'sessionId'),
      }
    }
    if (segments.length === 3) {
      return {
        kind: 'get_session',
        sessionId: assertSafeId(segments[2], 'sessionId'),
      }
    }
    if (segments.length === 4 && segments[3] === 'events') {
      return {
        kind: 'post_session_events',
        sessionId: assertSafeId(segments[2], 'sessionId'),
      }
    }
    if (segments.length === 4 && segments[3] !== 'events') {
      return {
        kind: 'get_session',
        sessionId: assertSafeId(segments[2], 'sessionId'),
      }
    }
  }

  if (segments[0] === 'v2' && segments[1] === 'session_ingress') {
    if (segments.length === 4 && segments[2] === 'ws') {
      return {
        kind: 'ws_session_ingress',
        sessionId: assertSafeId(segments[3], 'sessionId'),
      }
    }
    if (segments.length === 5 && segments[2] === 'session' && segments[4] === 'events') {
      return {
        kind: 'post_session_ingress_events',
        sessionId: assertSafeId(segments[3], 'sessionId'),
      }
    }
  }

  if (segments[0] === 'sessions' && segments.length === 4 && segments[2] === 'events' && segments[3] === 'stream') {
    return {
      kind: 'stream_session_events',
      sessionId: assertSafeId(segments[1], 'sessionId'),
    }
  }

  if (segments[0] === 'sessions' && segments.length === 3 && segments[2] === 'events') {
    return {
      kind: 'get_session_events',
      sessionId: assertSafeId(segments[1], 'sessionId'),
    }
  }

  return null
}
