import { useState } from 'react'
import type { EnvironmentRecord } from '../../shared/protocol'
import type { SessionSummary } from '../types'
import { toneForSession } from '../utils/format'
import { EnvironmentCard } from '../components/EnvironmentCard'

type OverviewPageProps = {
  environments: EnvironmentRecord[]
  sessions: SessionSummary[]
  selectedEnvironmentId: string | null
  featuredEnvironment: EnvironmentRecord | null
  loading: boolean
  onSelectEnvironment: (environmentId: string) => void
  onOpenSession: (sessionId: string) => void
  onCreateSession: (environmentId: string, title: string) => Promise<void>
  onRemoveSession: (sessionId: string) => Promise<void>
}

export function OverviewPage({
  environments,
  sessions,
  selectedEnvironmentId,
  featuredEnvironment,
  loading,
  onSelectEnvironment,
  onOpenSession,
  onCreateSession,
  onRemoveSession,
}: OverviewPageProps) {
  const hasEnvironments = environments.length > 0
  const environmentPreviewCount = 6
  const sessionPreviewCount = 6
  const [showAllEnvironments, setShowAllEnvironments] = useState(false)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const visibleEnvironments = showAllEnvironments
    ? environments
    : environments.slice(0, environmentPreviewCount)
  const visibleSessions = showAllSessions
    ? sessions
    : sessions.slice(0, sessionPreviewCount)
  const hasHiddenEnvironments = environments.length > environmentPreviewCount
  const hasHiddenSessions = sessions.length > sessionPreviewCount

  return (
    <section className="chat-shell overview-shell">
      <aside className="chat-sidebar">
        <div className="sidebar-head">
          <div>
            <p className="label">Environments</p>
            <h2>Bridge roster</h2>
          </div>
          <div className="status-pill" data-tone={loading ? 'warn' : 'good'}>
            {loading ? 'Refreshing' : `${environments.length} online`}
          </div>
        </div>

        <div className="environment-list">
          {environments.length ? (
            visibleEnvironments.map(env => {
              const active =
                env.id === selectedEnvironmentId ||
                (!selectedEnvironmentId && Boolean(env.activeSessionId))

              return (
                <button
                  key={env.id}
                  className={`environment-list-item${active ? ' active' : ''}`}
                  type="button"
                  onClick={() => {
                    onSelectEnvironment(env.id)
                    if (env.activeSessionId) {
                      onOpenSession(env.activeSessionId)
                    }
                  }}
                >
                  <span className="environment-list-name">
                    {env.machineName || env.id}
                  </span>
                  <span className="environment-list-meta">
                    {env.branch || 'no-branch'} · {env.status}
                  </span>
                </button>
              )
            })
          ) : (
            <div className="empty-state">
              <strong>No environments yet.</strong>
              <div className="hint">
                Register a CLI bridge and refresh to see it here.
              </div>
            </div>
          )}
        </div>
        {hasHiddenEnvironments ? (
          <button
            className="list-toggle"
            type="button"
            onClick={() => setShowAllEnvironments(current => !current)}
          >
            {showAllEnvironments
              ? 'Collapse environments'
              : `Show ${environments.length - visibleEnvironments.length} more environments`}
          </button>
        ) : null}

        <div className="sidebar-section">
          <div className="card-head compact-head">
            <div>
              <p className="label">Sessions</p>
              <h3>History</h3>
            </div>
          </div>

          <div className="session-list">
            {sessions.length ? (
              visibleSessions.map(session => {
                const removable =
                  session.status !== 'running' && session.status !== 'attached'

                return (
                  <div className="session-list-item" key={session.id}>
                    <button
                      className="session-list-main"
                      type="button"
                      onClick={() => onOpenSession(session.id)}
                    >
                      <span className="session-list-title">
                        {session.title || session.id}
                      </span>
                      <span className="session-list-meta">
                        {session.environmentId || 'no environment'} · {session.status}
                      </span>
                    </button>
                    <div className="session-list-actions">
                      <span
                        className="mini-pill"
                        data-tone={toneForSession(session.status)}
                      >
                        {session.status}
                      </span>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void onRemoveSession(session.id)}
                      >
                        {removable ? 'Remove' : 'Stop'}
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="empty-state compact-empty">No sessions yet.</div>
            )}
          </div>
          {hasHiddenSessions ? (
            <button
              className="list-toggle"
              type="button"
              onClick={() => setShowAllSessions(current => !current)}
            >
              {showAllSessions
                ? 'Collapse history'
                : `Show ${sessions.length - visibleSessions.length} more sessions`}
            </button>
          ) : null}
        </div>
      </aside>

      <section className="chat-stage welcome-stage">
        <div className="chat-stage-head">
          <div>
            <p className="label">Remote chat</p>
            <h2>{featuredEnvironment?.machineName || 'Remote Control Console'}</h2>
            <p className="muted">
              {featuredEnvironment
                ? `${featuredEnvironment.directory || 'Unknown directory'} on ${
                    featuredEnvironment.branch || 'no branch'
                  }`
                : 'Choose an environment to start a chat-oriented remote session.'}
            </p>
          </div>
        </div>

        {hasEnvironments ? (
          <div className="welcome-panel">
            <div className="welcome-orb"></div>
            <div className="welcome-copy">
              <div className="welcome-badge">Chat-first control plane</div>
              <h3>
                {featuredEnvironment?.activeSessionId
                  ? 'An active session is already running.'
                  : 'No active session yet.'}
              </h3>
              <p className="muted">
                The main surface is now rendered by React. Pick a worker on the left,
                then open the chat or spawn a fresh conversation.
              </p>
            </div>

            {featuredEnvironment ? (
              <EnvironmentCard
                environment={featuredEnvironment}
                onOpenSession={onOpenSession}
                onCreateSession={onCreateSession}
              />
            ) : null}
          </div>
        ) : (
          <section className="empty-welcome">
            <div className="empty-welcome-glow"></div>
            <div className="empty-welcome-grid"></div>
            <div className="empty-welcome-hero">
              <div className="empty-welcome-badge">Awaiting first bridge</div>
              <h3>No environments connected yet.</h3>
              <p className="muted">
                This stage becomes your live remote chat surface once a bridge
                registers. Until then, connect one worker and the console will turn
                into an active session dashboard.
              </p>
            </div>

            <div className="empty-welcome-preview">
              <div className="empty-preview-terminal">
                <div className="empty-preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="empty-preview-lines">
                  <span>$ remote-control bridge register</span>
                  <span>environment.status = "registered"</span>
                  <span>session.surface = ready</span>
                </div>
              </div>
            </div>

            <div className="empty-welcome-steps">
              <article className="empty-step-card">
                <span className="empty-step-index">01</span>
                <strong>Start a bridge</strong>
                <p className="muted">
                  Run your CLI bridge so an environment appears in the left roster.
                </p>
              </article>
              <article className="empty-step-card">
                <span className="empty-step-index">02</span>
                <strong>Refresh roster</strong>
                <p className="muted">
                  The sidebar will list the new machine as soon as the backend sees it.
                </p>
              </article>
              <article className="empty-step-card">
                <span className="empty-step-index">03</span>
                <strong>Open remote chat</strong>
                <p className="muted">
                  Select the environment and create a session to start the transcript.
                </p>
              </article>
            </div>
          </section>
        )}
      </section>
    </section>
  )
}
