import { dirname, join } from 'path'

export type AppConfig = {
  dbPaths: {
    legacyPath: string
    environmentsPath: string
    sessionsPath: string
    runtimePath: string
  }
  apiBaseUrl: string
  adminToken: string | null
  sessionLeaseMs: number
  idleHealthcheckEnabled: boolean
  debugEnabled: boolean
}

export function loadConfig(): AppConfig {
  const legacyPath =
    Bun.env.REMOTE_CONTROL_DB_PATH ??
    join(process.cwd(), 'data', 'remote-control-db.json')
  const dataDir = dirname(legacyPath)

  return {
    dbPaths: {
      legacyPath,
      environmentsPath: join(dataDir, 'environments.json'),
      sessionsPath: join(dataDir, 'sessions.json'),
      runtimePath: join(dataDir, 'runtime.json'),
    },
    apiBaseUrl: Bun.env.REMOTE_CONTROL_API_BASE_URL?.replace(/\/+$/, '') ?? '',
    adminToken: Bun.env.REMOTE_CONTROL_ADMIN_TOKEN?.trim() || null,
    sessionLeaseMs: Number(Bun.env.REMOTE_CONTROL_WORK_LEASE_MS ?? 5 * 60 * 1000),
    idleHealthcheckEnabled: Bun.env.REMOTE_CONTROL_ENABLE_HEALTHCHECK === '1',
    debugEnabled: Bun.env.REMOTE_CONTROL_DEBUG === '1',
  }
}
