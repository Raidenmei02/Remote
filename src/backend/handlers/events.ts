import type { SessionEventRecord } from '../../shared/protocol'
import { bearerToken, requireSessionToken } from '../auth'
import type { AppContext, RuntimeContext } from '../context'
import { buildEventRecord, canonicalizeIncomingEvent } from '../domain'
import { json, now, readJsonBody, sseHeaders } from '../http'
import type { IncomingEventPayload, SseClient } from '../types'

export async function appendSessionEvents(
  context: AppContext,
  request: Request,
  sessionId: string,
): Promise<Response> {
  const session = context.store.findSession(sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }
  if (!requireSessionToken(request, session, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = (await readJsonBody<{ events?: IncomingEventPayload[] } & IncomingEventPayload>(request)) ?? {}
  const rawEvents = Array.isArray(body.events) ? body.events : [body]
  const appended: SessionEventRecord[] = []
  const backfillState = context.store.snapshot

  await context.store.mutate(draft => {
    const sessionDraft = draft.sessions.find(item => item.id === session.id)
    const environment = draft.environments.find(item => item.id === session.environmentId)
    if (!sessionDraft || !environment) return

    for (const rawEvent of rawEvents) {
      const canonical = canonicalizeIncomingEvent(rawEvent)
      if (!canonical) {
        continue
      }

      const existing = draft.sessionEvents.find(
        item => item.sessionId === session.id && item.uuid === canonical.payload.uuid,
      )
      if (existing) {
        continue
      }

      const seq = sessionDraft.lastEventSeq + 1
      sessionDraft.lastEventSeq = seq
      sessionDraft.lastActivityAt = now()
      environment.lastSeenAt = now()
      if (canonical.recordType === 'user' || canonical.recordType === 'assistant') {
        sessionDraft.status = sessionDraft.status === 'attached' ? 'running' : 'running'
      } else if (canonical.recordType === 'result') {
        const subtype = typeof canonical.payload.subtype === 'string' ? canonical.payload.subtype : ''
        sessionDraft.status = subtype === 'success' ? 'completed' : 'disconnected'
        if (subtype === 'success') {
          environment.status = 'registered'
          environment.activeSessionId = null
        }
      } else if (sessionDraft.status === 'created') {
        sessionDraft.status = 'waiting_for_cli'
      }

      const record = buildEventRecord(session.id, seq, canonical.recordType, canonical.payload)
      draft.sessionEvents.push(record)
      appended.push(record)
    }
  })

  const snapshot = context.store.snapshot
  const latestSession = snapshot.sessions.find(item => item.id === session.id) ?? session
  const latestEnvironment =
    snapshot.environments.find(item => item.id === session.environmentId) ??
    backfillState.environments.find(item => item.id === session.environmentId) ??
    null
  const workItems = snapshot.workItems.filter(item => item.sessionId === session.id)

  for (const event of appended) {
    context.hub.broadcastEvent(session.id, event)
  }
  context.debug.log('events', 'appended', {
    sessionId: session.id,
    count: appended.length,
    seqs: appended.map(item => item.seq),
    types: appended.map(item => item.type),
  })
  context.hub.broadcastSessionState({
    session: latestSession,
    environment: latestEnvironment,
    workItems,
    events: appended,
  })

  if (appended.length === 0) {
    return new Response(null, { status: 204 })
  }
  return json({ ok: true, appended: appended.length, session_id: session.id })
}

export async function listSessionEvents(
  context: AppContext,
  sessionId: string,
): Promise<Response> {
  const session = context.store.findSession(sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }
  return json({
    data: context.store.listSessionEvents(sessionId),
  })
}

export async function streamSessionEvents(
  context: AppContext,
  request: Request,
  sessionId: string,
): Promise<Response> {
  const session = context.store.findSession(sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }

  const afterSeq = resolveEventCursor(request)
  context.debug.log('sse', 'subscribe', {
    sessionId,
    afterSeq,
  })
  const environment = context.store.findEnvironment(session.environmentId) ?? null
  const workItems = context.store.snapshot.workItems.filter(item => item.sessionId === session.id)
  const snapshot = {
    session,
    environment,
    workItems,
    events: context.store.listSessionEvents(sessionId),
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client: SseClient = { controller, sessionId }
      context.sseClientBySession.set(sessionId, client)
      context.hub.subscribeSse(sessionId, client)
      context.hub.sendSnapshot(sessionId, snapshot, afterSeq)
    },
    cancel() {
      const client = context.sseClientBySession.get(sessionId)
      if (client) {
        context.hub.unsubscribeSse(sessionId, client)
        context.sseClientBySession.delete(sessionId)
      }
    },
  })

  return new Response(stream, {
    headers: sseHeaders(),
  })
}

export function resolveEventCursor(request: Request): number {
  const url = new URL(request.url)
  const query = url.searchParams.get('after') ?? url.searchParams.get('last_event_seq')
  if (query) {
    const parsed = Number(query)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  const header = request.headers.get('last-event-id')
  if (header) {
    const parsed = Number(header)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

export function upgradeSessionWs(
  context: RuntimeContext,
  request: Request,
  sessionId: string,
): Response {
  const session = context.store.findSession(sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }

  const token = bearerToken(request)
  if (token !== session.sessionIngressToken && token !== context.config.adminToken) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const afterSeq = resolveEventCursor(request)
  const ok = context.getServer().upgrade(request, {
    data: { sessionId, afterSeq },
  })
  context.debug.log('ws', 'upgrade', {
    sessionId,
    afterSeq,
    ok,
  })
  return ok ? new Response(null, { status: 101 }) : json({ error: 'WebSocket upgrade failed' }, 400)
}

export async function handleConnectionLoss(
  context: AppContext,
  sessionId: string,
): Promise<void> {
  if (context.hub.hasWs(sessionId)) {
    return
  }
  const session = context.store.findSession(sessionId)
  if (!session || session.status === 'completed') return
  await context.store.mutate(draft => {
    const sessionDraft = draft.sessions.find(item => item.id === sessionId)
    const environment = draft.environments.find(item => item.id === session.environmentId)
    if (!sessionDraft || !environment) return
    sessionDraft.status = 'disconnected'
    sessionDraft.lastActivityAt = now()
    environment.status = environment.activeSessionId ? 'disconnected' : environment.status
    environment.lastSeenAt = now()
  })
  context.debug.log('ws', 'connection-lost', {
    sessionId,
  })
}
