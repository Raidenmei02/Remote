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

  const payload = await context.store.mutate(draft => {
    const existing = draft.environments.find(item => item.id === environmentId)
    const record: EnvironmentRecord = existing
      ? {
          ...existing,
          machineName,
          directory,
          branch,
          workerType,
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
