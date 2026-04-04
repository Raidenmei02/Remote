export const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export type EnvironmentStatus =
  | 'registered'
  | 'idle'
  | 'attached'
  | 'disconnected'
  | 'expired'

export type SessionStatus =
  | 'created'
  | 'waiting_for_cli'
  | 'attached'
  | 'running'
  | 'completed'
  | 'disconnected'

export type WorkItemType = 'session' | 'healthcheck'
export type WorkItemState = 'queued' | 'leased' | 'acknowledged' | 'completed'
export type SessionEventDirection = 'web_to_cli' | 'cli_to_web'
export type SessionEventType = 'user' | 'assistant' | 'system' | 'result'

export type EnvironmentRecord = {
  id: string
  secret: string
  machineName: string
  directory: string
  branch: string
  workerType: string
  spawnMode: 'single-session' | 'worktree' | 'same-dir'
  lastSeenAt: string
  status: EnvironmentStatus
  activeSessionId: string | null
}

export type SessionRecord = {
  id: string
  environmentId: string
  title: string
  status: SessionStatus
  createdAt: string
  lastEventSeq: number
  sessionIngressToken: string
  lastActivityAt: string
}

export type WorkSecret = {
  version: 1
  session_ingress_token: string
  api_base_url: string
  auth: Array<{ type: string; token: string }>
  sources: Array<{ type: string }>
  use_code_sessions?: boolean
}

export type WorkItemRecord = {
  id: string
  environmentId: string
  sessionId: string
  type: WorkItemType
  state: WorkItemState
  leaseUntil: string
  secretPayload: WorkSecret
  createdAt: string
  ackedAt: string | null
}

export type SessionEventRecord = {
  id: string
  sessionId: string
  seq: number
  uuid: string
  direction: SessionEventDirection
  type: SessionEventType
  payload: Record<string, unknown>
  createdAt: string
}

export type DatabaseShape = {
  environments: EnvironmentRecord[]
  sessions: SessionRecord[]
  workItems: WorkItemRecord[]
  sessionEvents: SessionEventRecord[]
}

export type BridgeEnvironmentRegisterRequest = {
  machine_name?: string
  directory?: string
  branch?: string
  metadata?: {
    worker_type?: string
    spawn_mode?: EnvironmentRecord['spawnMode']
  }
}

export type CreateSessionRequest = {
  environment_id: string
  title?: string
}

export type SessionIngressEvent = {
  type: string
  uuid?: string
  [key: string]: unknown
}

export function assertSafeId(id: string, label: string): string {
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${label}`)
  }
  return id
}
