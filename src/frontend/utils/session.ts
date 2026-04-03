import type { EnvironmentRecord, SessionEventRecord } from '../../shared/protocol'
import type { EventListResponse } from '../types'
import { tryParse } from './json'

export function pickSelectedEnvironmentId(
  currentId: string | null,
  environments: EnvironmentRecord[],
) {
  if (!environments.length) return null
  if (currentId && environments.some(item => item.id === currentId)) {
    return currentId
  }
  return environments.find(item => item.activeSessionId)?.id || environments[0].id
}

export function normalizeEvents(input: EventListResponse | null) {
  if (!input) return []
  const list = Array.isArray(input)
    ? input
    : Array.isArray(input.events)
      ? input.events
      : Array.isArray(input.data)
        ? input.data
        : []

  return list
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      ...item,
      seq: typeof item.seq === 'number' ? item.seq : Number(item.seq ?? 0),
    }))
    .sort((a, b) => a.seq - b.seq)
}

export function parseStreamMessage(raw: string) {
  const parsed = tryParse<Record<string, unknown> | SessionEventRecord[]>(raw)
  if (!parsed) return []
  if (Array.isArray(parsed)) return normalizeEvents(parsed)
  if (Array.isArray(parsed.events)) return normalizeEvents(parsed.events as SessionEventRecord[])
  if (Array.isArray(parsed.data)) return normalizeEvents(parsed.data as SessionEventRecord[])
  if (parsed && typeof parsed === 'object' && 'type' in parsed) {
    return normalizeEvents([parsed as unknown as SessionEventRecord])
  }
  return []
}

export function mergeEvents(existing: SessionEventRecord[], incoming: SessionEventRecord[]) {
  const next = [...existing]
  const seen = new Set(next.map(eventKey))

  for (const event of incoming) {
    const key = eventKey(event)
    if (seen.has(key)) continue
    next.push(event)
    seen.add(key)
  }

  return next.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
}

export function eventKey(
  event: Pick<SessionEventRecord, 'sessionId' | 'uuid' | 'seq' | 'type'>,
) {
  return `${event.sessionId || ''}:${event.uuid || ''}:${event.seq ?? ''}:${event.type || ''}`
}

export function formatEventBody(event: SessionEventRecord) {
  return extractDisplayText(event.payload) || JSON.stringify(event.payload ?? event, null, 2)
}

export function eventSummary(event: SessionEventRecord) {
  return formatEventBody(event) || `${event.direction || 'event'} ${event.uuid || ''}`.trim()
}

function extractDisplayText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(extractDisplayText).filter(Boolean).join('\n')
  }
  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  if (typeof record.text === 'string') return record.text
  if (typeof record.content === 'string') return record.content

  if (record.message) {
    const fromMessage = extractDisplayText(record.message)
    if (fromMessage) return fromMessage
  }
  if (record.payload) {
    const fromPayload = extractDisplayText(record.payload)
    if (fromPayload) return fromPayload
  }
  if (Array.isArray(record.content)) {
    const fromBlocks = record.content.map(extractDisplayText).filter(Boolean).join('\n')
    if (fromBlocks) return fromBlocks
  }

  return ''
}
