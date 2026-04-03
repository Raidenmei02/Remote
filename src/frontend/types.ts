import type {
  EnvironmentRecord,
  SessionEventRecord,
  SessionRecord,
  WorkItemRecord,
} from '../shared/protocol'

export type RouteState =
  | { kind: 'overview' }
  | { kind: 'session'; sessionId: string }

export type SessionSummary = SessionRecord & {
  environment?: EnvironmentRecord | null
}

export type SessionDetail = SessionRecord & {
  environment?: EnvironmentRecord | null
  workItems?: WorkItemRecord[]
}

export type EventListResponse =
  | SessionEventRecord[]
  | {
      events?: SessionEventRecord[]
      data?: SessionEventRecord[]
    }

