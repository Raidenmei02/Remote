import { assertSafeId } from '../../shared/protocol'
import { bearerToken, requireEnvironmentToken } from '../auth'
import type { AppContext } from '../context'
import { json, now, readJsonBody } from '../http'
import { workResponse } from '../domain'

export async function pollWork(
  context: AppContext,
  request: Request,
  environmentId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  if (!requireEnvironmentToken(request, env, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const reclaimOlderThanMs = Number(
    new URL(request.url).searchParams.get('reclaim_older_than_ms') ?? '0',
  )
  const nowMs = Date.now()

  const work = await context.store.mutate(draft => {
    const candidate = draft.workItems.find(item => {
      if (item.environmentId !== env.id) return false
      if (item.state === 'acknowledged' || item.state === 'completed') return false
      const leaseExpires = Date.parse(item.leaseUntil)
      if (item.state === 'leased' && leaseExpires > nowMs) {
        return false
      }
      if (item.state === 'leased' && reclaimOlderThanMs > 0) {
        return nowMs - leaseExpires >= reclaimOlderThanMs
      }
      return item.state === 'queued' || leaseExpires <= nowMs
    })

    if (!candidate) {
      env.lastSeenAt = now()
      return null
    }

    candidate.state = 'leased'
    candidate.leaseUntil = new Date(nowMs + context.config.sessionLeaseMs).toISOString()
    env.lastSeenAt = now()
    env.status = 'idle'
    return candidate
  })

  if (!work) {
    context.debug.log('work', 'poll-empty', {
      environmentId,
    })
    return new Response(null, { status: 204 })
  }

  context.debug.log('work', 'leased', {
    environmentId,
    workId: work.id,
    sessionId: work.sessionId,
    state: work.state,
    type: work.type,
  })

  return json(workResponse(work))
}

export async function ackWork(
  context: AppContext,
  request: Request,
  environmentId: string,
  workId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  if (!requireEnvironmentToken(request, env, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const work = context.store.findWorkItem(workId)
  if (!work || work.environmentId !== env.id) {
    return json({ error: 'Work not found' }, 404)
  }
  const session = context.store.findSession(work.sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }
  const token = bearerToken(request)
  if (context.config.adminToken ? token !== session.sessionIngressToken && token !== context.config.adminToken : false) {
    return json({ error: 'Unauthorized' }, 401)
  }

  await context.store.mutate(draft => {
    const item = draft.workItems.find(entry => entry.id === work.id)
    const sessionDraft = draft.sessions.find(entry => entry.id === work.sessionId)
    const environment = draft.environments.find(entry => entry.id === env.id)
    if (!item || !sessionDraft || !environment) return
    item.state = 'acknowledged'
    item.ackedAt = now()
    sessionDraft.status = 'attached'
    sessionDraft.lastActivityAt = now()
    environment.status = 'attached'
    environment.lastSeenAt = now()
  })

  context.debug.log('work', 'ack', {
    environmentId,
    workId,
    sessionId: session.id,
  })

  return json({ ok: true })
}

export async function heartbeatWork(
  context: AppContext,
  request: Request,
  environmentId: string,
  workId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  if (!requireEnvironmentToken(request, env, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const work = context.store.findWorkItem(workId)
  if (!work || work.environmentId !== env.id) {
    return json({ error: 'Work not found' }, 404)
  }
  const session = context.store.findSession(work.sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }
  const token = bearerToken(request)
  if (context.config.adminToken ? token !== session.sessionIngressToken && token !== context.config.adminToken : false) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const updated = await context.store.mutate(draft => {
    const item = draft.workItems.find(entry => entry.id === work.id)
    const sessionDraft = draft.sessions.find(entry => entry.id === work.sessionId)
    const environment = draft.environments.find(entry => entry.id === env.id)
    if (!item || !sessionDraft || !environment) return null
    item.leaseUntil = new Date(Date.now() + context.config.sessionLeaseMs).toISOString()
    environment.lastSeenAt = now()
    if (sessionDraft.status !== 'completed') {
      sessionDraft.status = sessionDraft.status === 'created' ? 'waiting_for_cli' : sessionDraft.status
    }
    sessionDraft.lastActivityAt = now()
    return { lease_extended: true, state: item.state }
  })

  context.debug.log('work', 'heartbeat', {
    environmentId,
    workId,
    sessionId: session.id,
    leaseExtended: updated?.lease_extended ?? false,
    state: updated?.state ?? work.state,
  })

  return json(updated ?? { lease_extended: false, state: work.state })
}

export async function stopWork(
  context: AppContext,
  request: Request,
  environmentId: string,
  workId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  if (!requireEnvironmentToken(request, env, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const work = context.store.findWorkItem(workId)
  if (!work || work.environmentId !== env.id) {
    return json({ error: 'Work not found' }, 404)
  }

  const body = (await readJsonBody<{ force?: boolean }>(request)) ?? {}

  const result = await context.store.mutate(draft => {
    const item = draft.workItems.find(entry => entry.id === work.id)
    const session = draft.sessions.find(entry => entry.id === work.sessionId)
    const environment = draft.environments.find(entry => entry.id === env.id)
    if (!item || !session || !environment) return null

    item.state = 'completed'
    item.leaseUntil = now()
    session.status = body.force ? 'disconnected' : 'completed'
    session.lastActivityAt = now()
    environment.activeSessionId = null
    environment.status = 'registered'
    environment.lastSeenAt = now()
    return {
      ok: true,
      work_id: item.id,
      session_id: session.id,
      state: item.state,
      force: !!body.force,
    }
  })

  context.debug.log('work', 'stop', {
    environmentId,
    workId,
    sessionId: work.sessionId,
    force: !!body.force,
    ok: Boolean(result),
  })

  return json(result ?? { ok: false }, result ? 200 : 404)
}

export async function reconnectSession(
  context: AppContext,
  request: Request,
  environmentId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  if (!requireEnvironmentToken(request, env, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await readJsonBody<{ session_id?: string }>(request)
  const sessionId = body?.session_id
    ? assertSafeId(body.session_id, 'session_id')
    : env.activeSessionId
  if (!sessionId) {
    return json({ error: 'Missing session_id' }, 400)
  }

  const session = context.store.findSession(sessionId)
  if (!session || session.environmentId !== env.id) {
    return json({ error: 'Session not found' }, 404)
  }

  await context.store.mutate(draft => {
    const sessionDraft = draft.sessions.find(item => item.id === session.id)
    const environment = draft.environments.find(item => item.id === env.id)
    const work = draft.workItems.find(item => item.sessionId === session.id && item.type === 'session')
    if (!sessionDraft || !environment || !work) return
    sessionDraft.status = 'waiting_for_cli'
    sessionDraft.lastActivityAt = now()
    work.state = 'queued'
    work.leaseUntil = now()
    environment.activeSessionId = session.id
    environment.status = 'idle'
    environment.lastSeenAt = now()
  })

  context.debug.log('session', 'reconnect-queued', {
    environmentId,
    sessionId: session.id,
  })

  return json({ ok: true, session_id: session.id })
}
