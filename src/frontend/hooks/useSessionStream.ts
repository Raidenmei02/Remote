import { useEffect, useRef, useState } from 'react'
import type { SessionEventRecord } from '../../shared/protocol'
import type { RouteState, SessionDetail } from '../types'
import { parseStreamMessage } from '../utils/session'
import { basePath } from '../utils/storage'
import { tryParse } from '../utils/json'

export function useSessionStream({
  baseUrl,
  route,
  onEvents,
  onSnapshot,
  onSessionState,
}: {
  baseUrl: string
  route: RouteState
  onEvents: (events: SessionEventRecord[]) => void
  onSnapshot: (events: SessionEventRecord[]) => void
  onSessionState: (session: Partial<SessionDetail>) => void
}) {
  const [streamStatus, setStreamStatus] = useState('disconnected')
  const streamRef = useRef<EventSource | null>(null)
  const onEventsRef = useRef(onEvents)
  const onSnapshotRef = useRef(onSnapshot)
  const onSessionStateRef = useRef(onSessionState)

  onEventsRef.current = onEvents
  onSnapshotRef.current = onSnapshot
  onSessionStateRef.current = onSessionState

  useEffect(() => {
    if (route.kind !== 'session') {
      streamRef.current?.close()
      streamRef.current = null
      setStreamStatus('disconnected')
      return
    }

    const source = new EventSource(
      `${basePath(baseUrl)}/sessions/${encodeURIComponent(route.sessionId)}/events/stream`,
    )

    streamRef.current?.close()
    streamRef.current = source
    setStreamStatus('connecting')

    source.onopen = () => setStreamStatus('attached')
    source.onerror = () => {
      setStreamStatus(
        source.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting',
      )
    }
    source.onmessage = event => {
      onEventsRef.current(parseStreamMessage(event.data))
    }
    source.addEventListener('snapshot', event => {
      onSnapshotRef.current(parseStreamMessage(event.data))
    })
    source.addEventListener('session_event', event => {
      onEventsRef.current(parseStreamMessage(event.data))
    })
    source.addEventListener('session_state', event => {
      const parsed = tryParse<Record<string, unknown>>(event.data)
      if (parsed?.session && typeof parsed.session === 'object') {
        onSessionStateRef.current(parsed.session as Partial<SessionDetail>)
      }
    })

    return () => {
      source.close()
      if (streamRef.current === source) {
        streamRef.current = null
      }
      setStreamStatus('disconnected')
    }
  }, [baseUrl, route.kind, route.kind === 'session' ? route.sessionId : ''])

  return streamStatus
}
