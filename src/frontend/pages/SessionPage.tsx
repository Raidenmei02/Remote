import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { SessionEventRecord } from '../../shared/protocol'
import { ExecutionTimelineItem } from '../components/ExecutionTimelineItem'
import { JsonCodeBlock } from '../components/JsonCodeBlock'
import { SessionStateRow } from '../components/SessionStateRow'
import { StructuredMessage } from '../components/StructuredMessage'
import type { SessionDetail } from '../types'
import {
  autoResizeTextarea,
  formatTime,
  toneForSession,
  truncateText,
} from '../utils/format'
import {
  buildChatMessages,
  buildExecutionTimeline,
  structureSessionEvents,
} from '../utils/session'

type SessionPageProps = {
  session: SessionDetail | null
  events: SessionEventRecord[]
  streamStatus: string
  sidebarCollapsed: boolean
  sidebarWidth: number
  sessionId: string
  onBack: () => void
  onToggleSidebar: () => void
  onSidebarWidthChange: (width: number) => void
  onSendMessage: (text: string) => Promise<void>
}

export function SessionPage({
  session,
  events,
  streamStatus,
  sidebarCollapsed,
  sidebarWidth,
  sessionId,
  onBack,
  onToggleSidebar,
  onSidebarWidthChange,
  onSendMessage,
}: SessionPageProps) {
  const [message, setMessage] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const shellRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const structuredEntries = structureSessionEvents(events)
  const chatMessages = buildChatMessages(structuredEntries)
  const executionTimeline = buildExecutionTimeline(structuredEntries).reverse()
  const latestEvent = events.at(-1)
  const title = session?.title || sessionId
  const sessionTone = toneForSession(session?.status)
  const statusText = session?.status || 'loading'
  const collapsedCards = [
    {
      key: 'state',
      label: 'State',
      icon: <SessionGlyph />,
      summary: truncateText(session?.environmentId || 'No env', 18),
      detail: `${statusText} · ${streamStatus}`,
    },
    {
      key: 'inspector',
      label: 'Inspector',
      icon: <TimelineGlyph />,
      summary: `${events.length} events`,
      detail: latestEvent ? formatTime(latestEvent.createdAt) : 'No activity',
    },
    {
      key: 'json',
      label: 'JSON',
      icon: <CodeGlyph />,
      summary: `seq ${session?.lastEventSeq ?? '—'}`,
      detail: truncateText(session?.id || sessionId, 14),
    },
  ]

  useEffect(() => {
    autoResizeTextarea(inputRef.current)
  }, [message])

  useEffect(() => {
    if (!isResizing) return

    const onPointerMove = (event: PointerEvent) => {
      const shell = shellRef.current
      if (!shell) return
      const bounds = shell.getBoundingClientRect()
      const minWidth = 280
      const maxWidth = Math.min(560, bounds.width * 0.5)
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, event.clientX - bounds.left))
      onSidebarWidthChange(nextWidth)
    }

    const stopResize = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onSidebarWidthChange])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    setMessage('')
    await onSendMessage(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <section
      ref={shellRef}
      className={`chat-shell session-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
      style={
        sidebarCollapsed
          ? undefined
          : ({ '--session-sidebar-width': `${sidebarWidth}px` } as CSSProperties)
      }
    >
      <section className="chat-stage transcript-stage">
        <div className="chat-stage-head stage-header">
          <div className="stage-header-main">
            <button className="button secondary back-button" type="button" onClick={onBack}>
              Back
            </button>
            <div>
              <p className="label">Live transcript</p>
              <h2 className="session-title">{title}</h2>
              <p className="muted session-subtitle">
                {session ? `${session.environmentId} · active remote transcript` : 'Loading session details'}
              </p>
            </div>
          </div>
          <div className="stage-header-meta">
            <span className={`status-pill`} data-tone={sessionTone}>
              {statusText}
            </span>
            <span className="session-summary-id">
              {truncateText(session?.id || sessionId, 24)}
            </span>
            <span className="session-summary-status">seq {session?.lastEventSeq ?? '—'}</span>
          </div>
        </div>

        <div className="transcript-layout">
          <section className="conversation-panel">
            <div className="card-head compact-stage-head">
              <div>
                <p className="label">Chat</p>
                <h3>Conversation</h3>
              </div>
              <span className="muted sidebar-count">{chatMessages.length} messages</span>
            </div>

            <div className="chat-scroll conversation-scroll">
              <div className="message-stream chat-messages">
                {chatMessages.length ? (
                  chatMessages.map(entry => (
                    <StructuredMessage entry={entry} key={entry.id} />
                  ))
                ) : (
                  <div className="empty-state">
                    <strong>No chat messages yet.</strong>
                    <div className="hint">
                      Send the first prompt or wait for the CLI to answer.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form className="composer composer-docked" onSubmit={submit}>
              <label className="composer-shell" htmlFor="message-input">
                <textarea
                  id="message-input"
                  ref={inputRef}
                  rows={1}
                  placeholder="Message the remote agent"
                  autoComplete="off"
                  spellCheck={true}
                  value={message}
                  onChange={event => setMessage(event.currentTarget.value)}
                  onKeyDown={onKeyDown}
                />
                <button className="button composer-send" type="submit">
                  Send
                </button>
              </label>
              <div className="form-actions form-actions-inline">
                <p className="hint">Enter sends. Shift+Enter inserts a newline.</p>
                <span className="muted">Primary action anchored to the chat column</span>
              </div>
            </form>
          </section>

          <aside className="execution-panel">
            <div className="card-head compact-stage-head">
              <div>
                <p className="label">Execution</p>
                <h3>Timeline</h3>
              </div>
              <span className="muted sidebar-count">{executionTimeline.length} items</span>
            </div>

            <div className="execution-list">
              {executionTimeline.length ? (
                executionTimeline.map(item => (
                  <ExecutionTimelineItem item={item} key={item.id} />
                ))
              ) : (
                <div className="empty-state compact-empty">
                  Execution details will appear here as tools run.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <button
        className={`sidebar-fab-toggle${sidebarCollapsed ? ' is-collapsed' : ''}`}
        type="button"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleSidebar}
      >
        <span className="sidebar-fab-icon" aria-hidden="true">
          {sidebarCollapsed ? '‹' : '›'}
        </span>
      </button>

      {!sidebarCollapsed ? (
        <button
          className={`sidebar-resizer${isResizing ? ' is-active' : ''}`}
          type="button"
          aria-label="Resize sidebar"
          onPointerDown={event => {
            event.preventDefault()
            setIsResizing(true)
          }}
        />
      ) : null}

      <aside
        className={`chat-sidebar session-sidebar diagnostics-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}
      >
        <div className="session-sidebar-toolbar">
          <div>
            <p className="label">Diagnostics</p>
            <h3>State and Inspector</h3>
          </div>
          <span className={`status-dot status-dot-${sessionTone}`} aria-hidden="true"></span>
        </div>

        <div className="session-sidebar-rail">
          <div className="session-rail-head">
            <span className={`status-dot status-dot-${sessionTone}`} aria-hidden="true"></span>
          </div>
          {collapsedCards.map(card => (
            <button
              key={card.key}
              className="session-rail-card"
              type="button"
              onClick={onToggleSidebar}
              aria-label={`Expand sidebar to view ${card.label}`}
              data-tooltip={`${card.label}\n${card.summary}\n${card.detail}`}
            >
              <span className="session-rail-icon">{card.icon}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-block session-summary-block">
          <div className="session-summary-head">
            <div>
              <p className="label">Session</p>
              <h2 className="session-title">{title}</h2>
            </div>
            <span className={`status-dot status-dot-${sessionTone}`} aria-hidden="true"></span>
          </div>
          <div className="session-summary-meta">
            <span className="session-summary-id">{truncateText(session?.id || sessionId, 24)}</span>
            <span className="session-summary-status">{statusText}</span>
          </div>
          <p className="muted session-subtitle">
            {session ? `${session.environmentId} · ${streamStatus}` : 'Loading diagnostics'}
          </p>
        </div>

        <section className="sidebar-card overview-card">
          <div className="card-head card-head-tight">
            <div>
              <p className="label">Overview</p>
              <h3>Session state</h3>
            </div>
            <span className="muted sidebar-count">Live</span>
          </div>
          <div className="state-list">
            <SessionStateRow
              label="Environment"
              value={session?.environmentId || '—'}
              truncate={32}
            />
            <SessionStateRow
              label="Connection"
              value={`${streamStatus} · ${statusText}`}
            />
            <SessionStateRow
              label="Last activity"
              value={session?.lastActivityAt ? formatTime(session.lastActivityAt) : '—'}
            />
            <SessionStateRow
              label="Last event"
              value={latestEvent ? `${latestEvent.type} #${latestEvent.seq ?? '—'}` : '—'}
              truncate={120}
            />
          </div>
        </section>

        <section className="sidebar-card metadata-card">
          <div className="card-head">
            <div>
              <p className="label">Metadata</p>
              <h3>Session JSON</h3>
            </div>
            <span className="muted sidebar-count">Inspector</span>
          </div>
          <JsonCodeBlock value={session || {}} collapsedLines={11} />
        </section>

        <section className="sidebar-card metadata-card">
          <div className="card-head">
            <div>
              <p className="label">Events</p>
              <h3>Latest event JSON</h3>
            </div>
            <span className="muted sidebar-count">{latestEvent ? latestEvent.type : 'None'}</span>
          </div>
          <JsonCodeBlock value={latestEvent || {}} collapsedLines={11} />
        </section>
      </aside>
    </section>
  )
}

function SessionGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9h8M8 13h8M8 17h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

function TimelineGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  )
}

function CodeGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 8 5 12l4 4M15 8l4 4-4 4M13 6l-2 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  )
}
