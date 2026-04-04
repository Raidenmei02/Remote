import { makeId, makeToken } from '../../lib/ids'
import { assertSafeId, type EnvironmentRecord, type SessionRecord, type WorkItemRecord } from '../../shared/protocol'
import { requireAdminAccess } from '../auth'
import type { AppContext } from '../context'
import { sessionIngressUrl } from '../context'
import { buildWorkSecret } from '../domain'
import { json, now, readJsonBody, safeString } from '../http'

export async function createSession(context: AppContext, request: Request): Promise<Response> {
  if (!requireAdminAccess(request, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = (await readJsonBody<{ environment_id?: string; title?: string }>(request)) ?? {}
  const environmentId = body.environment_id
    ? assertSafeId(body.environment_id, 'environment_id')
    : null
  if (!environmentId) {
    return json({ error: 'Missing environment_id' }, 400)
  }
  const title = safeString(body.title, 'Remote Control session')

  let response: { session: SessionRecord; work: WorkItemRecord; environment: EnvironmentRecord }
  try {
    response = await context.store.mutate(draft => {
      const environment = draft.environments.find(item => item.id === environmentId)
      if (!environment) {
        throw new Error('Environment not found')
      }

      const activeSession =
        environment.activeSessionId &&
        draft.sessions.find(item => item.id === environment.activeSessionId)
      if (activeSession && activeSession.status !== 'completed' && activeSession.status !== 'disconnected') {
        throw new Error('Environment already has an active session')
      }

      const sessionId = makeId('ses')
      const sessionIngressToken = makeToken()
      const session: SessionRecord = {
        id: sessionId,
        environmentId,
        title,
        status: 'waiting_for_cli',
        createdAt: now(),
        lastEventSeq: 0,
        sessionIngressToken,
        lastActivityAt: now(),
      }
      const work: WorkItemRecord = {
        id: makeId('wrk'),
        environmentId,
        sessionId,
        type: 'session',
        state: 'queued',
        leaseUntil: now(),
        secretPayload: buildWorkSecret(context.config, session),
        createdAt: now(),
        ackedAt: null,
      }
      environment.activeSessionId = sessionId
      environment.lastSeenAt = now()
      environment.status = 'idle'
      draft.sessions.push(session)
      draft.workItems.push(work)
      return { session, work, environment }
    })
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Session creation failed',
      },
      409,
    )
  }

  context.debug.log('session', 'created', {
    sessionId: response.session.id,
    environmentId: response.environment.id,
    workId: response.work.id,
    title: response.session.title,
  })

  context.hub.broadcastSessionState({
    session: response.session,
    environment: response.environment,
    workItems: [response.work],
    events: [],
  })

  return json({
    id: response.session.id,
    environment_id: response.environment.id,
    title: response.session.title,
    status: response.session.status,
    work_id: response.work.id,
    session_ingress_url: sessionIngressUrl(context.config, response.session.id),
  })
}

export async function listSessions(context: AppContext): Promise<Response> {
  const snapshot = context.store.snapshot
  return json({
    data: snapshot.sessions.map(session => ({
      ...session,
      environment: snapshot.environments.find(env => env.id === session.environmentId) ?? null,
    })),
  })
}

export async function getSession(context: AppContext, sessionId: string): Promise<Response> {
  const session = context.store.findSession(sessionId)
  if (!session) {
    return json({ error: 'Session not found' }, 404)
  }
  const environment = context.store.findEnvironment(session.environmentId) ?? null
  const workItems = context.store.snapshot.workItems.filter(item => item.sessionId === session.id)
  return json({
    ...session,
    environment,
    workItems,
  })
}

export async function archiveSession(
  context: AppContext,
  request: Request,
  sessionId: string,
): Promise<Response> {
  if (!requireAdminAccess(request, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const existingSession = context.store.findSession(sessionId)
  if (!existingSession) {
    return json({ error: 'Session not found' }, 404)
  }

  const hasActiveWork = context.store.snapshot.workItems.some(
    item => item.sessionId === sessionId && item.state !== 'completed',
  )
  const isAlreadyArchived =
    existingSession.status === 'completed' &&
    !hasActiveWork &&
    (context.store.findEnvironment(existingSession.environmentId)?.activeSessionId ?? null) !== sessionId

  if (isAlreadyArchived) {
    return json({ error: 'Session already archived' }, 409)
  }

  const result = await context.store.mutate(draft => {
    const session = draft.sessions.find(item => item.id === sessionId)
    if (!session) return null

    const environment = draft.environments.find(item => item.id === session.environmentId) ?? null
    const workItems = draft.workItems.filter(item => item.sessionId === session.id)

    session.status = 'completed'
    session.lastActivityAt = now()

    for (const workItem of workItems) {
      workItem.state = 'completed'
      workItem.leaseUntil = now()
    }

    if (environment?.activeSessionId === session.id) {
      environment.activeSessionId = null
      environment.status = 'registered'
      environment.lastSeenAt = now()
    }

    return {
      id: session.id,
      archived: true,
      environment_id: session.environmentId,
      completed_work_items: workItems.length,
    }
  })

  if (!result) {
    return json({ error: 'Session not found' }, 404)
  }

  context.debug.log('session', 'archived', {
    sessionId: result.id,
    environmentId: result.environment_id,
    completedWorkItems: result.completed_work_items,
  })

  return json(result)
}
