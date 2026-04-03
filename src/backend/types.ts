import type { EnvironmentRecord, SessionEventRecord, SessionRecord, WorkItemRecord } from '../shared/protocol'

export type CanonicalEventType = 'user' | 'assistant' | 'system' | 'result'

export type IncomingEventPayload = Record<string, unknown> & {
  type?: string
  uuid?: string
}

export type SessionSnapshot = {
  session: SessionRecord
  environment: EnvironmentRecord | null
  workItems: WorkItemRecord[]
  events: SessionEventRecord[]
}

export type SseClient = {
  controller: ReadableStreamDefaultController<Uint8Array>
  sessionId: string
}

export type WsData = {
  sessionId: string
  afterSeq: number
}

export type Route =
  | { kind: 'register_environment' }
  | { kind: 'environments_root' }
  | { kind: 'get_environment'; environmentId: string }
  | { kind: 'poll_work'; environmentId: string }
  | { kind: 'ack_work'; environmentId: string; workId: string }
  | { kind: 'heartbeat_work'; environmentId: string; workId: string }
  | { kind: 'stop_work'; environmentId: string; workId: string }
  | { kind: 'reconnect_session'; environmentId: string }
  | { kind: 'sessions_root' }
  | { kind: 'get_session'; sessionId: string }
  | { kind: 'get_session_events'; sessionId: string }
  | { kind: 'post_session_events'; sessionId: string }
  | { kind: 'post_session_ingress_events'; sessionId: string }
  | { kind: 'stream_session_events'; sessionId: string }
  | { kind: 'ws_session_ingress'; sessionId: string }
