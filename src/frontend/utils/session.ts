import type { EnvironmentRecord, SessionEventRecord } from '../../shared/protocol'
import type {
  EventListResponse,
  StructuredMessageBlock,
  StructuredMessageGroup,
  StructuredSessionEntry,
  TimelineItemViewModel,
} from '../types'
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

export function structureSessionEvents(
  events: SessionEventRecord[],
): StructuredSessionEntry[] {
  return events.map(event => {
    const blocks = parseStructuredBlocks(event)

    return {
      id: event.id,
      seq: event.seq ?? 0,
      role: normalizeStructuredRole(event, blocks),
      createdAt: event.createdAt,
      blocks,
      rawEvent: event,
    }
  })
}

export function summarizeStructuredEntry(
  entry: StructuredSessionEntry,
): TimelineItemViewModel {
  const firstBlock = entry.blocks[0]
  if (!firstBlock) {
    return {
      id: entry.id,
      seq: entry.seq,
      title: entry.role,
      summary: 'No details',
      createdAt: entry.createdAt,
      tone: 'warn',
    }
  }

  switch (firstBlock.kind) {
    case 'tool_use':
      return {
        id: entry.id,
        seq: entry.seq,
        title: firstBlock.toolName || 'Tool',
        summary:
          typeof firstBlock.input.command === 'string'
            ? String(firstBlock.input.command)
            : 'Tool invoked',
        createdAt: entry.createdAt,
      }
    case 'tool_result':
      return {
        id: entry.id,
        seq: entry.seq,
        title: 'Tool result',
        summary: firstBlock.isError ? 'Command failed' : 'Command completed',
        createdAt: entry.createdAt,
        tone: firstBlock.isError ? 'bad' : 'good',
      }
    case 'result':
      return {
        id: entry.id,
        seq: entry.seq,
        title: 'Turn completed',
        summary: firstBlock.subtype || 'result',
        createdAt: entry.createdAt,
        tone: firstBlock.subtype === 'success' ? 'good' : 'bad',
      }
    case 'status':
      return {
        id: entry.id,
        seq: entry.seq,
        title: firstBlock.label,
        summary: firstBlock.value,
        createdAt: entry.createdAt,
      }
    case 'text':
      return {
        id: entry.id,
        seq: entry.seq,
        title: entry.role === 'user' ? 'You' : 'Assistant',
        summary: firstBlock.text,
        createdAt: entry.createdAt,
      }
    case 'json':
      return {
        id: entry.id,
        seq: entry.seq,
        title: firstBlock.label,
        summary: 'Structured fallback',
        createdAt: entry.createdAt,
        tone: 'warn',
      }
  }
}

export function groupStructuredEntries(
  entries: StructuredSessionEntry[],
): StructuredMessageGroup[] {
  const groups: StructuredMessageGroup[] = []

  for (const entry of entries) {
    const previous = groups.at(-1)
    const canMerge =
      previous &&
      entry.role === 'assistant' &&
      previous.role === 'assistant'
    const attachResultToAssistant =
      previous &&
      entry.role === 'result' &&
      previous.role === 'assistant'

    if (canMerge || attachResultToAssistant) {
      previous.entries.push(entry)
      previous.blocks.push(...entry.blocks)
      previous.seqEnd = entry.seq
      previous.createdAt = entry.createdAt
      continue
    }

    groups.push({
      id: entry.id,
      role: entry.role,
      createdAt: entry.createdAt,
      seqStart: entry.seq,
      seqEnd: entry.seq,
      entries: [entry],
      blocks: [...entry.blocks],
    })
  }

  return groups
}

function parseStructuredBlocks(event: SessionEventRecord): StructuredMessageBlock[] {
  const payload = event.payload as Record<string, unknown>
  const blocks: StructuredMessageBlock[] = []

  if (event.type === 'result') {
    blocks.push({
      kind: 'result',
      subtype: stringValue(payload.subtype),
      text: stringValue(payload.result),
      durationMs: numberValue(payload.duration_ms),
      durationApiMs: numberValue(payload.duration_api_ms),
      costUsd: numberValue(payload.total_cost_usd),
      stopReason: stringValue(payload.stop_reason),
      usage: objectValue(payload.usage) ?? undefined,
    })
    return blocks
  }

  if (event.type === 'system') {
    const summary = extractDisplayText(payload)
    if (summary) {
      blocks.push({
        kind: 'status',
        label: 'System event',
        value: summary,
      })
    } else {
      blocks.push({
        kind: 'json',
        label: 'System event',
        value: payload,
      })
    }
    return blocks
  }

  const message = objectValue(payload.message)
  const content = Array.isArray(message?.content)
    ? message.content
    : typeof message?.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : []

  if (!content.length && typeof payload.text === 'string') {
    blocks.push({
      kind: 'text',
      text: payload.text,
    })
  }

  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const block = item as Record<string, unknown>
    const blockType = stringValue(block.type)

    if (blockType === 'text') {
      const text = stringValue(block.text) || extractDisplayText(block)
      if (text) {
        blocks.push({ kind: 'text', text })
      }
      continue
    }

    if (blockType === 'tool_use') {
      blocks.push({
        kind: 'tool_use',
        toolCallId: stringValue(block.id),
        toolName: stringValue(block.name),
        input: objectValue(block.input) ?? {},
      })
      continue
    }

    if (blockType === 'tool_result') {
      const result = objectValue(payload.tool_use_result) ?? {}
      blocks.push({
        kind: 'tool_result',
        toolUseId: stringValue(block.tool_use_id),
        content: stringValue(block.content),
        stdout: stringValue(result.stdout),
        stderr: stringValue(result.stderr),
        isError: booleanValue(block.is_error),
        interrupted: booleanValue(result.interrupted),
        isImage: booleanValue(result.isImage),
      })
      continue
    }

    blocks.push({
      kind: 'json',
      label: `Unsupported block: ${blockType || 'unknown'}`,
      value: block,
    })
  }

  if (!blocks.length) {
    const fallbackText = extractDisplayText(payload)
    blocks.push(
      fallbackText
        ? { kind: 'text', text: fallbackText }
        : { kind: 'json', label: `${event.type || 'event'} payload`, value: payload },
    )
  }

  return blocks
}

function normalizeStructuredRole(
  event: SessionEventRecord,
  blocks: StructuredMessageBlock[],
): StructuredSessionEntry['role'] {
  if (event.type === 'result') {
    return 'result'
  }

  if (blocks.some(block => block.kind === 'tool_use' || block.kind === 'tool_result')) {
    return 'assistant'
  }

  if (event.direction === 'web_to_cli') {
    return 'user'
  }

  if (event.type === 'assistant' || event.type === 'system') {
    return event.type
  }

  return 'assistant'
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
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
