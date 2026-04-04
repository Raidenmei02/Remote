import { makeId, makeToken } from '../../lib/ids'
import { assertSafeId, type BridgeEnvironmentRegisterRequest, type EnvironmentRecord } from '../../shared/protocol'
import { requireAdminAccess } from '../auth'
import type { AppContext } from '../context'
import { json, now, readJsonBody, safeString } from '../http'

export async function registerEnvironment(
  context: AppContext,
  request: Request,
): Promise<Response> {
  if (!requireAdminAccess(request, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = (await readJsonBody<BridgeEnvironmentRegisterRequest & {
    environment_id?: string
    directory?: string
    branch?: string
    git_repo_url?: string
    max_sessions?: number
  }>(request)) ?? {}

  const environmentId = body.environment_id
    ? assertSafeId(body.environment_id, 'environment_id')
    : makeId('env')
  const machineName = safeString(body.machine_name, 'local-machine')
  const directory = safeString(body.directory, process.cwd())
  const branch = safeString(body.branch, 'main')
  const workerType = safeString(body.metadata?.worker_type, 'remote-control')
  const spawnMode = body.metadata?.spawn_mode === 'worktree' || body.metadata?.spawn_mode === 'same-dir'
    ? body.metadata.spawn_mode
    : 'single-session'

  const payload = await context.store.mutate(draft => {
    const existing = draft.environments.find(item => item.id === environmentId)
    const record: EnvironmentRecord = existing
      ? {
          ...existing,
          machineName,
          directory,
          branch,
          workerType,
          spawnMode,
          lastSeenAt: now(),
          status: existing.status === 'expired' ? 'registered' : existing.status,
        }
      : {
          id: environmentId,
          secret: makeToken(),
          machineName,
          directory,
          branch,
          workerType,
          spawnMode,
          lastSeenAt: now(),
          status: 'registered',
          activeSessionId: null,
        }

    if (existing) {
      Object.assign(existing, record)
    } else {
      draft.environments.push(record)
    }
    return record
  })

  context.debug.log('environment', 'registered', {
    environmentId: payload.id,
    machineName: payload.machineName,
    directory: payload.directory,
    branch: payload.branch,
    workerType: payload.workerType,
    spawnMode: payload.spawnMode,
  })

  return json({
    environment_id: payload.id,
    environment_secret: payload.secret,
  })
}

export async function listEnvironments(context: AppContext): Promise<Response> {
  const snapshot = context.store.snapshot
  return json(
    snapshot.environments.map(env => ({
      ...env,
      activeSession: env.activeSessionId
        ? snapshot.sessions.find(session => session.id === env.activeSessionId) ?? null
        : null,
    })),
  )
}

export async function getEnvironment(
  context: AppContext,
  environmentId: string,
): Promise<Response> {
  const env = context.store.findEnvironment(environmentId)
  if (!env) {
    return json({ error: 'Environment not found' }, 404)
  }
  const session = env.activeSessionId ? context.store.findSession(env.activeSessionId) ?? null : null
  return json({
    ...env,
    activeSession: session,
  })
}

export async function deleteEnvironment(
  context: AppContext,
  request: Request,
  environmentId: string,
): Promise<Response> {
  if (!requireAdminAccess(request, context.config.adminToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let removed:
    | {
        environmentId: string
        removedSessions: number
        removedWorkItems: number
        removedEvents: number
      }
    | null = null

  try {
    removed = await context.store.mutate(draft => {
      const environment = draft.environments.find(item => item.id === environmentId)
      if (!environment) {
        throw new Error('Environment not found')
      }

      const sessionIds = new Set(
        draft.sessions
          .filter(item => item.environmentId === environmentId)
          .map(item => item.id),
      )
      const removedSessions = sessionIds.size
      const removedWorkItems = draft.workItems.filter(item => item.environmentId === environmentId).length
      const removedEvents = draft.sessionEvents.filter(item => sessionIds.has(item.sessionId)).length

      draft.environments = draft.environments.filter(item => item.id !== environmentId)
      draft.sessions = draft.sessions.filter(item => item.environmentId !== environmentId)
      draft.workItems = draft.workItems.filter(item => item.environmentId !== environmentId)
      draft.sessionEvents = draft.sessionEvents.filter(item => !sessionIds.has(item.sessionId))

      return {
        environmentId,
        removedSessions,
        removedWorkItems,
        removedEvents,
      }
    })
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Environment deletion failed',
      },
      error instanceof Error && error.message === 'Environment not found' ? 404 : 409,
    )
  }

  context.debug.log('environment', 'deleted', removed)

  return json({
    deleted: true,
    environment_id: removed.environmentId,
    removed_sessions: removed.removedSessions,
    removed_work_items: removed.removedWorkItems,
    removed_events: removed.removedEvents,
  })
}
