import type { JsonStore } from '../lib/store'
import type { SessionRecord } from '../shared/protocol'
import type { AppConfig } from './config'
import type { DebugLogger } from './debug'
import type { SessionHub } from './sessionHub'
import type { SseClient, WsData } from './types'

export type AppContext = {
  store: JsonStore
  hub: SessionHub
  config: AppConfig
  debug: DebugLogger
  sseClientBySession: Map<string, SseClient>
}

export type RuntimeContext = AppContext & {
  getServer: () => Bun.Server
}

export function sessionIngressUrl(config: AppConfig, sessionId: string): string {
  const base = config.apiBaseUrl.replace(/\/+$/, '')
  return `${base}/v2/session_ingress/ws/${sessionId}`
}

export function sessionStatePayload(context: AppContext, session: SessionRecord) {
  return {
    session,
    environment: context.store.findEnvironment(session.environmentId) ?? null,
    workItems: context.store.snapshot.workItems.filter(item => item.sessionId === session.id),
    events: context.store.listSessionEvents(session.id),
  }
}
