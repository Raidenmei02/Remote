import type { SessionStatus } from '../../shared/protocol'

export function toneForSession(status?: SessionStatus | null) {
  if (status === 'completed' || status === 'running' || status === 'attached') return 'good'
  if (status === 'disconnected') return 'bad'
  if (status === 'waiting_for_cli' || status === 'created' || !status) return 'warn'
  return 'good'
}

export function toneForStream(status: string) {
  if (status === 'attached') return 'good'
  if (status === 'reconnecting') return 'warn'
  if (status === 'disconnected') return 'bad'
  return 'warn'
}

export function toneForString(value: string) {
  if (['registered', 'idle', 'attached'].includes(value)) return 'good'
  if (['disconnected', 'expired'].includes(value)) return 'bad'
  return 'warn'
}

export function truncateText(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = '0px'
  element.style.height = `${Math.min(element.scrollHeight, 220)}px`
}
