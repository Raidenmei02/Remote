import { mkdir } from 'fs/promises'
import { join } from 'path'
import { JsonStore } from './lib/store'
import { buildFrontendBundle, servePublicAsset } from './backend/frontend'
import { loadConfig } from './backend/config'
import { createDebugLogger } from './backend/debug'
import { SessionHub } from './backend/sessionHub'
import { parseRoute } from './backend/routes'
import { json, now } from './backend/http'
import {
  deleteEnvironment,
  getEnvironment,
  listEnvironments,
  registerEnvironment,
} from './backend/handlers/environments'
import {
  archiveSession,
  createSession,
  getSession,
  listSessions,
} from './backend/handlers/sessions'
import {
  ackWork,
  heartbeatWork,
  pollWork,
  reconnectSession,
  stopWork,
} from './backend/handlers/work'
import {
  appendSessionEvents,
  handleConnectionLoss,
  listSessionEvents,
  streamSessionEvents,
  upgradeSessionWs,
} from './backend/handlers/events'
import type { RuntimeContext } from './backend/context'
import type { SseClient, WsData } from './backend/types'

const config = loadConfig()
const debug = createDebugLogger(config.debugEnabled)
const store = new JsonStore(config.dbPaths)
const hub = new SessionHub(store, debug)
const sseClientBySession = new Map<string, SseClient>()

await mkdir(join(process.cwd(), 'data'), { recursive: true })
await buildFrontendBundle()
await store.init()

const requestedPort = Bun.env.PORT ? Number(Bun.env.PORT) : null
let serverRef!: Bun.Server

const context: RuntimeContext = {
  store,
  hub,
  config,
  debug,
  sseClientBySession,
  getServer: () => serverRef,
}

const server = Bun.serve({
  port: requestedPort ?? 0,
  websocket: {
    open(ws: Bun.ServerWebSocket<WsData>) {
      const { sessionId, afterSeq } = ws.data
      debug.log('ws', 'open', {
        sessionId,
        afterSeq,
      })
      hub.subscribeWs(sessionId, ws)
      void store.mutate(draft => {
        const session = draft.sessions.find(item => item.id === sessionId)
        const environment = session
          ? draft.environments.find(item => item.id === session.environmentId)
          : undefined
        if (!session || !environment) return
        if (session.status !== 'completed') {
          session.status = 'attached'
          session.lastActivityAt = now()
          environment.status = 'attached'
          environment.lastSeenAt = now()
        }
      })
      hub.replayToWs(sessionId, afterSeq)
    },
    close(ws: Bun.ServerWebSocket<WsData>) {
      debug.log('ws', 'close', {
        sessionId: ws.data.sessionId,
      })
      hub.unsubscribeWs(ws.data.sessionId, ws)
      handleConnectionLoss(context, ws.data.sessionId).catch(() => {})
    },
    message(
      _ws: Bun.ServerWebSocket<WsData>,
      _message: string | ArrayBufferLike,
    ) {
      // The backend only uses WebSockets as a read channel for the CLI.
    },
  },
  fetch: async request => {
    const url = new URL(request.url)
    debug.request(request)
    if (request.method === 'GET' && url.pathname === '/healthz') {
      const response = json({ ok: true })
      debug.response(request, response.status)
      return response
    }

    const asset = request.method === 'GET' ? servePublicAsset(url.pathname) : null
    if (asset) {
      return asset
    }

    const route = parseRoute(url.pathname)
    if (!route) {
      if (request.method === 'GET' && !url.pathname.startsWith('/v1/') && !url.pathname.startsWith('/v2/') && !url.pathname.startsWith('/sessions/')) {
        const response = new Response(Bun.file(join(process.cwd(), 'src', 'frontend', 'index.html')))
        debug.response(request, response.status)
        return response
      }
      const response = json({ error: 'Not found' }, 404)
      debug.response(request, response.status)
      return response
    }

    if (route.kind === 'ws_session_ingress') {
      const response = upgradeSessionWs(context, request, route.sessionId)
      debug.response(request, response.status, { route: route.kind, sessionId: route.sessionId })
      return response
    }

    try {
      let response: Response
      switch (route.kind) {
        case 'register_environment':
        case 'environments_root':
          response = request.method === 'POST'
            ? await registerEnvironment(context, request)
            : await listEnvironments(context)
          break
        case 'delete_bridge_environment':
          response = await deleteEnvironment(context, request, route.environmentId)
          break
        case 'get_environment':
          response = request.method === 'DELETE'
            ? await deleteEnvironment(context, request, route.environmentId)
            : await getEnvironment(context, route.environmentId)
          break
        case 'poll_work':
          response = await pollWork(context, request, route.environmentId)
          break
        case 'ack_work':
          response = await ackWork(context, request, route.environmentId, route.workId)
          break
        case 'heartbeat_work':
          response = await heartbeatWork(context, request, route.environmentId, route.workId)
          break
        case 'stop_work':
          response = await stopWork(context, request, route.environmentId, route.workId)
          break
        case 'reconnect_session':
          response = await reconnectSession(context, request, route.environmentId)
          break
        case 'sessions_root':
          response = request.method === 'POST'
            ? await createSession(context, request)
            : await listSessions(context)
          break
        case 'get_session':
          response = await getSession(context, route.sessionId)
          break
        case 'archive_session':
          response = await archiveSession(context, request, route.sessionId)
          break
        case 'get_session_events':
          response = await listSessionEvents(context, route.sessionId)
          break
        case 'post_session_events':
          response = await appendSessionEvents(context, request, route.sessionId)
          break
        case 'stream_session_events':
          response = await streamSessionEvents(context, request, route.sessionId)
          break
        case 'post_session_ingress_events':
          response = await appendSessionEvents(context, request, route.sessionId)
          break
      }
      debug.response(request, response.status, { route: route.kind })
      return response
    } catch (error) {
      debug.log('http', 'error', {
        method: request.method,
        path: url.pathname,
        route: route.kind,
        error: error instanceof Error ? error.message : 'Internal server error',
      })
      const response = json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        500,
      )
      debug.response(request, response.status, { route: route.kind })
      return response
    }
  },
})

serverRef = server

if (!config.apiBaseUrl) {
  config.apiBaseUrl = `http://127.0.0.1:${server.port}`
}

console.log(
  `Remote Control backend listening on ${server.hostname}:${server.port}`,
)
console.log(`Environment database: ${config.dbPaths.environmentsPath}`)
console.log(`Session database: ${config.dbPaths.sessionsPath}`)
console.log(`Runtime database: ${config.dbPaths.runtimePath}`)
if (config.debugEnabled) {
  console.log('Debug mode enabled (REMOTE_CONTROL_DEBUG=1)')
}

if (config.idleHealthcheckEnabled) {
  console.log('Healthcheck work mode enabled')
}
