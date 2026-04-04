import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import type { EnvironmentRecord, SessionEventRecord } from '../shared/protocol'
import {
  createSession,
  deleteEnvironment,
  fetchOverview,
  fetchSessionDetail,
  sendUserMessage,
  stopOrHideSession,
} from './api/client'
import { Topbar } from './components/Topbar'
import { useRouteState } from './hooks/useRouteState'
import { useSessionStream } from './hooks/useSessionStream'
import { OverviewPage } from './pages/OverviewPage'
import { SessionPage } from './pages/SessionPage'
import type { SessionDetail, SessionSummary } from './types'
import { formatError } from './utils/format'
import { openOverview, openSession } from './utils/routing'
import { mergeEvents, normalizeEvents, pickSelectedEnvironmentId } from './utils/session'
import {
  hideSessionLocally,
  readBaseUrl,
  readHiddenSessions,
  readSessionSidebarCollapsed,
  readSessionSidebarWidth,
  writeBaseUrl,
  writeSessionSidebarCollapsed,
  writeSessionSidebarWidth,
} from './utils/storage'

export function App() {
  const [baseUrl, setBaseUrl] = useState(() => readBaseUrl())
  const route = useRouteState()
  const [environments, setEnvironments] = useState<EnvironmentRecord[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [events, setEvents] = useState<SessionEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSessionSidebarCollapsed(),
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => readSessionSidebarWidth())
  const [refreshToken, setRefreshToken] = useState(0)

  const selectedSessionId = route.kind === 'session' ? route.sessionId : ''
  const featuredEnvironment =
    environments.find(item => item.id === selectedEnvironmentId) ||
    environments.find(item => item.activeSessionId) ||
    environments[0] ||
    null

  useEffect(() => {
    let cancelled = false

    async function loadCurrentView() {
      setLoading(true)
      setError('')

      try {
        if (route.kind === 'session') {
          const next = await fetchSessionDetail(baseUrl, route.sessionId)
          if (cancelled) return

          startTransition(() => {
            setSession(next.session)
            setEvents(normalizeEvents(next.events))
          })
          return
        }

        const next = await fetchOverview(baseUrl)
        if (cancelled) return

        const hiddenSessions = readHiddenSessions()

        startTransition(() => {
          setEnvironments(next.environments)
          setSessions(next.sessions.filter(item => !hiddenSessions.has(item.id)))
          setSelectedEnvironmentId(currentId =>
            pickSelectedEnvironmentId(currentId, next.environments),
          )
          setSession(null)
          setEvents([])
        })
      } catch (loadError) {
        if (!cancelled) {
          setError(formatError(loadError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCurrentView()

    return () => {
      cancelled = true
    }
  }, [baseUrl, route, refreshToken])

  useEffect(() => {
    if (route.kind !== 'overview') return
    setSelectedEnvironmentId(currentId =>
      pickSelectedEnvironmentId(currentId, environments),
    )
  }, [route.kind, environments])

  const handleIncomingEvents = useEffectEvent((incoming: SessionEventRecord[]) => {
    if (!incoming.length) return
    setEvents(current => mergeEvents(current, incoming))
  })

  const handleSnapshotEvents = useEffectEvent((incoming: SessionEventRecord[]) => {
    if (!incoming.length) return
    setEvents(current => mergeEvents(current, incoming))
  })

  const handleSessionState = useEffectEvent((incoming: Partial<SessionDetail>) => {
    setSession(current => (current ? { ...current, ...incoming } : (incoming as SessionDetail)))
  })

  const streamStatus = useSessionStream({
    baseUrl,
    route,
    onEvents: handleIncomingEvents,
    onSnapshot: handleSnapshotEvents,
    onSessionState: handleSessionState,
  })

  const refresh = () => {
    setRefreshToken(current => current + 1)
  }

  const handleBaseUrlCommit = (nextValue: string) => {
    const normalized = nextValue.trim().replace(/\/+$/, '')
    setBaseUrl(normalized)
    writeBaseUrl(normalized)
    setRefreshToken(current => current + 1)
  }

  const handleCreateSession = async (environmentId: string, title: string) => {
    const created = await createSession(baseUrl, environmentId, title)
    openSession(created.id)
  }

  const handleRemoveSession = async (sessionId: string) => {
    const result = await stopOrHideSession(baseUrl, sessionId)
    if (!result.removedRemotely) {
      hideSessionLocally(sessionId)
      setSessions(current => current.filter(item => item.id !== sessionId))
    }
    refresh()
  }

  const handleRemoveEnvironment = async (environmentId: string) => {
    await deleteEnvironment(baseUrl, environmentId)
    setEnvironments(current => current.filter(item => item.id !== environmentId))
    setSessions(current => current.filter(item => item.environmentId !== environmentId))
    setSelectedEnvironmentId(currentId =>
      currentId === environmentId ? null : currentId,
    )
    refresh()
  }

  const handleSendMessage = async (text: string) => {
    if (!selectedSessionId) return
    await sendUserMessage(baseUrl, selectedSessionId, text)
    refresh()
  }

  const handleToggleSidebar = () => {
    const nextValue = !sidebarCollapsed
    setSidebarCollapsed(nextValue)
    writeSessionSidebarCollapsed(nextValue)
  }

  const handleSidebarWidthChange = (nextWidth: number) => {
    setSidebarWidth(nextWidth)
    writeSessionSidebarWidth(nextWidth)
  }

  return (
    <div className="shell">
      <Topbar
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        onBaseUrlCommit={handleBaseUrlCommit}
        onRefresh={refresh}
      />

      <main className="app" aria-live="polite">
        {error ? <div className="error-banner">{error}</div> : null}

        {route.kind === 'overview' ? (
          <OverviewPage
            environments={environments}
            sessions={sessions}
            selectedEnvironmentId={selectedEnvironmentId}
            featuredEnvironment={featuredEnvironment}
            loading={loading}
            onSelectEnvironment={setSelectedEnvironmentId}
            onOpenSession={openSession}
            onCreateSession={handleCreateSession}
            onRemoveEnvironment={handleRemoveEnvironment}
            onRemoveSession={handleRemoveSession}
          />
        ) : (
          <SessionPage
            session={session}
            events={events}
            streamStatus={streamStatus}
            sidebarCollapsed={sidebarCollapsed}
            sidebarWidth={sidebarWidth}
            sessionId={selectedSessionId}
            onBack={openOverview}
            onToggleSidebar={handleToggleSidebar}
            onSidebarWidthChange={handleSidebarWidthChange}
            onSendMessage={handleSendMessage}
          />
        )}
      </main>
    </div>
  )
}
