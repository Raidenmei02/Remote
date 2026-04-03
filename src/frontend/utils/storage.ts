const DEFAULT_BASE_URL = ''
const STORAGE_KEY = 'remote-control-console-base-url'

function hiddenSessionsKey() {
  return `${STORAGE_KEY}:hidden-sessions`
}

function sessionSidebarKey() {
  return `${STORAGE_KEY}:session-sidebar-collapsed`
}

function sessionSidebarWidthKey() {
  return `${STORAGE_KEY}:session-sidebar-width`
}

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

export function readBaseUrl() {
  return normalizeBaseUrl(localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL)
}

export function writeBaseUrl(value: string) {
  localStorage.setItem(STORAGE_KEY, normalizeBaseUrl(value))
}

export function basePath(baseUrl: string) {
  return baseUrl || DEFAULT_BASE_URL
}

export function readHiddenSessions() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(hiddenSessionsKey()) || '[]'))
  } catch {
    return new Set<string>()
  }
}

export function hideSessionLocally(sessionId: string) {
  const hidden = readHiddenSessions()
  hidden.add(sessionId)
  localStorage.setItem(hiddenSessionsKey(), JSON.stringify([...hidden]))
}

export function readSessionSidebarCollapsed() {
  return localStorage.getItem(sessionSidebarKey()) === '1'
}

export function writeSessionSidebarCollapsed(value: boolean) {
  localStorage.setItem(sessionSidebarKey(), value ? '1' : '0')
}

export function readSessionSidebarWidth() {
  const raw = localStorage.getItem(sessionSidebarWidthKey())
  const value = raw ? Number(raw) : NaN
  return Number.isFinite(value) ? value : 360
}

export function writeSessionSidebarWidth(value: number) {
  localStorage.setItem(sessionSidebarWidthKey(), String(Math.round(value)))
}
