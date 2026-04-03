import type { JsonStore } from '../lib/store'
import type { SessionEventRecord } from '../shared/protocol'
import type { DebugLogger } from './debug'
import type { SessionSnapshot, SseClient, WsData } from './types'

const encoder = new TextEncoder()

export class SessionHub {
  private sseClients = new Map<string, Set<SseClient>>()
  private wsClients = new Map<string, Set<Bun.ServerWebSocket<WsData>>>()

  constructor(
    private readonly store: JsonStore,
    private readonly debug: DebugLogger,
  ) {}

  subscribeSse(sessionId: string, client: SseClient): void {
    const set = this.sseClients.get(sessionId) ?? new Set<SseClient>()
    set.add(client)
    this.sseClients.set(sessionId, set)
  }

  unsubscribeSse(sessionId: string, client: SseClient): void {
    const set = this.sseClients.get(sessionId)
    if (!set) return
    set.delete(client)
    if (set.size === 0) {
      this.sseClients.delete(sessionId)
    }
  }

  subscribeWs(sessionId: string, ws: Bun.ServerWebSocket<WsData>): void {
    const set = this.wsClients.get(sessionId) ?? new Set<Bun.ServerWebSocket<WsData>>()
    set.add(ws)
    this.wsClients.set(sessionId, set)
    this.debug.log('ws', 'subscribed', {
      sessionId,
      clients: set.size,
    })
  }

  unsubscribeWs(sessionId: string, ws: Bun.ServerWebSocket<WsData>): void {
    const set = this.wsClients.get(sessionId)
    if (!set) return
    set.delete(ws)
    this.debug.log('ws', 'unsubscribed', {
      sessionId,
      clients: set.size,
    })
    if (set.size === 0) {
      this.wsClients.delete(sessionId)
    }
  }

  hasWs(sessionId: string): boolean {
    return (this.wsClients.get(sessionId)?.size ?? 0) > 0
  }

  broadcastEvent(sessionId: string, event: SessionEventRecord): void {
    const message = this.serializeSse('session_event', event, event.seq)
    this.emitSse(sessionId, message)
    this.emitWs(sessionId, `${JSON.stringify(event.payload)}\n`)
    this.debug.log('events', 'broadcast', {
      sessionId,
      seq: event.seq,
      type: event.type,
      direction: event.direction,
      wsClients: this.wsClients.get(sessionId)?.size ?? 0,
      sseClients: this.sseClients.get(sessionId)?.size ?? 0,
    })
  }

  broadcastSessionState(snapshot: SessionSnapshot): void {
    const payload = {
      session: snapshot.session,
      environment: snapshot.environment,
      workItems: snapshot.workItems,
    }
    this.emitSse(
      snapshot.session.id,
      this.serializeSse('session_state', payload, snapshot.session.lastEventSeq),
    )
  }

  sendSnapshot(sessionId: string, snapshot: SessionSnapshot, afterSeq: number): void {
    const payload = {
      session: snapshot.session,
      environment: snapshot.environment,
      workItems: snapshot.workItems,
      events: snapshot.events.filter(item => item.seq > afterSeq),
    }
    this.emitSse(sessionId, this.serializeSse('snapshot', payload, afterSeq))
  }

  replayToWs(sessionId: string, afterSeq: number): void {
    const events = this.store
      .listSessionEvents(sessionId)
      .filter(item => item.seq > afterSeq)
    this.debug.log('ws', 'replay', {
      sessionId,
      afterSeq,
      count: events.length,
    })
    for (const event of events) {
      this.emitWs(sessionId, `${JSON.stringify(event.payload)}\n`)
    }
  }

  private emitSse(sessionId: string, chunk: string): void {
    const set = this.sseClients.get(sessionId)
    if (!set) return
    for (const client of [...set]) {
      try {
        client.controller.enqueue(encoder.encode(chunk))
      } catch {
        this.unsubscribeSse(sessionId, client)
      }
    }
  }

  private emitWs(sessionId: string, chunk: string): void {
    const set = this.wsClients.get(sessionId)
    if (!set) return
    for (const ws of [...set]) {
      try {
        ws.send(chunk)
      } catch {
        this.unsubscribeWs(sessionId, ws)
      }
    }
  }

  private serializeSse(event: string, payload: unknown, id?: number | string): string {
    const parts: string[] = []
    if (id !== undefined) {
      parts.push(`id: ${String(id)}`)
    }
    parts.push(`event: ${event}`)
    parts.push(`data: ${JSON.stringify(payload)}`)
    return `${parts.join('\n')}\n\n`
  }
}
