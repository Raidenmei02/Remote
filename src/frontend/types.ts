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

export type StructuredMessageBlock =
  | {
      kind: 'text'
      text: string
    }
  | {
      kind: 'tool_use'
      toolCallId: string
      toolName: string
      input: Record<string, unknown>
    }
  | {
      kind: 'tool_result'
      toolUseId: string
      content: string
      stdout?: string
      stderr?: string
      isError: boolean
      interrupted: boolean
      isImage: boolean
    }
  | {
      kind: 'result'
      subtype: string
      text: string
      durationMs?: number
      durationApiMs?: number
      costUsd?: number
      stopReason?: string
      usage?: Record<string, unknown>
    }
  | {
      kind: 'status'
      label: string
      value: string
    }
  | {
      kind: 'json'
      label: string
      value: unknown
    }

export type StructuredSessionEntry = {
  id: string
  seq: number
  role: 'user' | 'assistant' | 'system' | 'result'
  createdAt: string
  blocks: StructuredMessageBlock[]
  rawEvent: SessionEventRecord
}

export type TimelineItemViewModel = {
  id: string
  seq: number
  title: string
  summary: string
  createdAt: string
  tone?: 'good' | 'warn' | 'bad'
}

export type ChatMessageViewModel = {
  id: string
  seq: number
  role: 'user' | 'assistant'
  createdAt: string
  text: string
  executionSummary?: {
    toolCalls: number
    toolResults: number
    hasError: boolean
    resultLabel?: string
  }
}

export type ExecutionTimelineItemViewModel =
  | {
      id: string
      seq: number
      kind: 'tool_use'
      title: string
      summary: string
      createdAt: string
      tone?: 'good' | 'warn' | 'bad'
      collapsedByDefault: boolean
      toolName: string
      command?: string
      input: Record<string, unknown>
    }
  | {
      id: string
      seq: number
      kind: 'tool_result'
      title: string
      summary: string
      createdAt: string
      tone?: 'good' | 'warn' | 'bad'
      collapsedByDefault: boolean
      toolUseId: string
      stdout?: string
      stderr?: string
      content: string
      isError: boolean
      interrupted: boolean
      isImage: boolean
      raw: Record<string, unknown>
    }
  | {
      id: string
      seq: number
      kind: 'result'
      title: string
      summary: string
      createdAt: string
      tone?: 'good' | 'warn' | 'bad'
      collapsedByDefault: boolean
      subtype: string
      text: string
      durationMs?: number
      durationApiMs?: number
      costUsd?: number
      stopReason?: string
      usage?: Record<string, unknown>
      raw: Record<string, unknown>
    }
  | {
      id: string
      seq: number
      kind: 'status'
      title: string
      summary: string
      createdAt: string
      tone?: 'good' | 'warn' | 'bad'
      collapsedByDefault: boolean
      raw: unknown
    }
  | {
      id: string
      seq: number
      kind: 'json'
      title: string
      summary: string
      createdAt: string
      tone?: 'good' | 'warn' | 'bad'
      collapsedByDefault: boolean
      raw: unknown
    }
