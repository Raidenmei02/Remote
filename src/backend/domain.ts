import { encodeWorkSecret } from '../lib/workSecret'
import { makeEventUuid } from '../lib/ids'
import type {
  EnvironmentRecord,
  SessionEventRecord,
  SessionRecord,
  SessionStatus,
  WorkItemRecord,
  WorkSecret,
} from '../shared/protocol'
import type { AppConfig } from './config'
import { now } from './http'
import type { CanonicalEventType, IncomingEventPayload } from './types'

export function buildWorkSecret(config: AppConfig, session: SessionRecord): WorkSecret {
  return {
    version: 1,
    session_ingress_token: session.sessionIngressToken,
    api_base_url: config.apiBaseUrl.replace(/\/+$/, ''),
    auth: [{ type: 'bearer', token: session.sessionIngressToken }],
    sources: [{ type: 'remote-control' }],
    use_code_sessions: false,
  }
}

export function workResponse(work: WorkItemRecord) {
  return {
    id: work.id,
    type: 'work',
    environment_id: work.environmentId,
    state: work.state,
    data: {
      type: work.type,
      id: work.sessionId,
    },
    secret: encodeWorkSecret(work.secretPayload),
    created_at: work.createdAt,
  }
}

export function deriveEnvironmentStatus(session?: SessionRecord | null): EnvironmentRecord['status'] {
  if (!session) return 'registered'
  if (session.status === 'completed') return 'registered'
  if (session.status === 'disconnected') return 'disconnected'
  if (session.status === 'attached' || session.status === 'running') return 'attached'
  return 'idle'
}

export function deriveSessionStatusFromEvent(
  current: SessionStatus,
  eventType: CanonicalEventType,
  payload: IncomingEventPayload,
): SessionStatus {
  if (current === 'completed') return current
  if (eventType === 'result') {
    const subtype = typeof payload.subtype === 'string' ? payload.subtype : null
    if (subtype === 'success') return 'completed'
    return 'disconnected'
  }
  if (eventType === 'assistant' || eventType === 'user') {
    return current === 'attached' ? 'running' : 'running'
  }
  return current === 'created' ? 'waiting_for_cli' : current
}

export function canonicalizeIncomingEvent(
  input: IncomingEventPayload,
): { recordType: CanonicalEventType; payload: IncomingEventPayload } | null {
  if (!input || typeof input !== 'object') return null
  const type = typeof input.type === 'string' ? input.type : ''
  const payloadObject =
    input.payload && typeof input.payload === 'object'
      ? (input.payload as Record<string, unknown>)
      : null
  if (type === 'control_request' || type === 'control_response') {
    return null
  }

  if (type === 'stream_event') {
    return {
      recordType: 'assistant',
      payload: {
        ...input,
        original_type: 'stream_event',
      },
    }
  }

  if (type === 'user' || type === 'assistant' || type === 'system' || type === 'result') {
    const payload: IncomingEventPayload = payloadObject
      ? {
          ...payloadObject,
          type,
          uuid:
            typeof input.uuid === 'string'
              ? input.uuid
              : typeof payloadObject.uuid === 'string'
                ? payloadObject.uuid
                : undefined,
        }
      : { ...input }
    if (type === 'user' && typeof payload.text === 'string' && !payload.message) {
      payload.message = {
        content: [{ type: 'text', text: payload.text }],
      }
    }
    if (typeof payload.uuid !== 'string' || !payload.uuid.trim()) {
      payload.uuid = makeEventUuid()
    }
    return { recordType: type, payload }
  }

  return null
}

export function buildEventRecord(
  sessionId: string,
  seq: number,
  type: CanonicalEventType,
  payload: IncomingEventPayload,
): SessionEventRecord {
  return {
    id: makeEventUuid(),
    sessionId,
    seq,
    uuid: payload.uuid ?? makeEventUuid(),
    direction: type === 'user' ? 'web_to_cli' : 'cli_to_web',
    type,
    payload,
    createdAt: now(),
  }
}

export function sessionEventText(record: SessionEventRecord): string {
  return JSON.stringify(record.payload)
}
