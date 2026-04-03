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
