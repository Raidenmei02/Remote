import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type {
  DatabaseShape,
  EnvironmentRecord,
  SessionEventRecord,
  SessionRecord,
  WorkItemRecord,
} from '../shared/protocol'

const EMPTY_DB: DatabaseShape = {
  environments: [],
  sessions: [],
  workItems: [],
  sessionEvents: [],
}

type StorePaths = {
  legacyPath: string
  environmentsPath: string
  sessionsPath: string
  runtimePath: string
}

type EnvironmentDatabaseShape = Pick<DatabaseShape, 'environments'>
type SessionDatabaseShape = Pick<DatabaseShape, 'sessions'>
type RuntimeDatabaseShape = Pick<DatabaseShape, 'workItems' | 'sessionEvents'>

function normalizeDatabaseShape(input: unknown): DatabaseShape {
  if (!input || typeof input !== 'object') {
    return structuredClone(EMPTY_DB)
  }

  const data = input as Partial<DatabaseShape>

  return {
    environments: Array.isArray(data.environments) ? data.environments : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    workItems: Array.isArray(data.workItems) ? data.workItems : [],
    sessionEvents: Array.isArray(data.sessionEvents) ? data.sessionEvents : [],
  }
}

export class JsonStore {
  private data: DatabaseShape = structuredClone(EMPTY_DB)
  private loaded = false
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly paths: StorePaths) {}

  async init(): Promise<void> {
    if (this.loaded) return
    await Promise.all([
      mkdir(dirname(this.paths.environmentsPath), { recursive: true }),
      mkdir(dirname(this.paths.sessionsPath), { recursive: true }),
      mkdir(dirname(this.paths.runtimePath), { recursive: true }),
    ])

    const legacyData = await this.readLegacyDatabase()
    const environments = await this.readPartition(
      this.paths.environmentsPath,
      legacyData ? { environments: legacyData.environments } : { environments: [] },
      input => ({
        environments: Array.isArray(input.environments) ? input.environments : [],
      }),
    )
    const sessions = await this.readPartition(
      this.paths.sessionsPath,
      legacyData ? { sessions: legacyData.sessions } : { sessions: [] },
      input => ({
        sessions: Array.isArray(input.sessions) ? input.sessions : [],
      }),
    )
    const runtime = await this.readPartition(
      this.paths.runtimePath,
      legacyData
        ? {
            workItems: legacyData.workItems,
            sessionEvents: legacyData.sessionEvents,
          }
        : { workItems: [], sessionEvents: [] },
      input => ({
        workItems: Array.isArray(input.workItems) ? input.workItems : [],
        sessionEvents: Array.isArray(input.sessionEvents) ? input.sessionEvents : [],
      }),
    )

    this.data = {
      environments: environments.environments,
      sessions: sessions.sessions,
      workItems: runtime.workItems,
      sessionEvents: runtime.sessionEvents,
    }

    await this.flush()
    this.loaded = true
  }

  get snapshot(): DatabaseShape {
    return this.data
  }

  async mutate<T>(fn: (draft: DatabaseShape) => T): Promise<T> {
    await this.init()
    let result!: T
    const next = this.writeQueue.then(async () => {
      result = fn(this.data)
      await this.flush()
    })
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    )
    await next
    return result
  }

  findEnvironment(id: string): EnvironmentRecord | undefined {
    return this.data.environments.find(item => item.id === id)
  }

  findSession(id: string): SessionRecord | undefined {
    return this.data.sessions.find(item => item.id === id)
  }

  findWorkItem(id: string): WorkItemRecord | undefined {
    return this.data.workItems.find(item => item.id === id)
  }

  listSessionEvents(sessionId: string): SessionEventRecord[] {
    return this.data.sessionEvents
      .filter(item => item.sessionId === sessionId)
      .sort((a, b) => a.seq - b.seq)
  }

  private async flush(): Promise<void> {
    const environments: EnvironmentDatabaseShape = {
      environments: this.data.environments,
    }
    const sessions: SessionDatabaseShape = {
      sessions: this.data.sessions,
    }
    const runtime: RuntimeDatabaseShape = {
      workItems: this.data.workItems,
      sessionEvents: this.data.sessionEvents,
    }

    await Promise.all([
      writeFile(this.paths.environmentsPath, JSON.stringify(environments, null, 2)),
      writeFile(this.paths.sessionsPath, JSON.stringify(sessions, null, 2)),
      writeFile(this.paths.runtimePath, JSON.stringify(runtime, null, 2)),
    ])
  }

  private async readLegacyDatabase(): Promise<DatabaseShape | null> {
    if (!existsSync(this.paths.legacyPath)) {
      return null
    }

    const raw = await readFile(this.paths.legacyPath, 'utf8')
    if (!raw) {
      return null
    }

    return normalizeDatabaseShape(JSON.parse(raw))
  }

  private async readPartition<T>(
    filePath: string,
    fallback: T,
    normalize: (input: Record<string, unknown>) => T,
  ): Promise<T> {
    if (!existsSync(filePath)) {
      return fallback
    }

    const raw = await readFile(filePath, 'utf8')
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    return normalize(parsed)
  }
}
