import { useState } from 'react'
import type { EnvironmentRecord } from '../../shared/protocol'
import { formatTime, toneForString } from '../utils/format'

type EnvironmentCardProps = {
  environment: EnvironmentRecord
  draftTitle: string
  onOpenSession: (sessionId: string) => void
  onDraftTitleChange: (value: string) => void
  onRemoveEnvironment: (environmentId: string) => Promise<void>
}

export function EnvironmentCard({
  environment,
  draftTitle,
  onOpenSession,
  onDraftTitleChange,
  onRemoveEnvironment,
}: EnvironmentCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const hasActiveSession = Boolean(environment.activeSessionId)

  const remove = async () => {
    if (deleting) return

    const confirmed = globalThis.confirm(
      `Delete environment "${environment.id}" and all related sessions, work items, and events?`,
    )
    if (!confirmed) return

    setDeleting(true)
    setError('')

    try {
      await onRemoveEnvironment(environment.id)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to delete environment')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="card environment-card" data-environment-id={environment.id}>
      <div className="card-head">
        <div>
          <p className="label">Environment</p>
          <h3 className="environment-title">{environment.id}</h3>
        </div>
        <span className="status-pill" data-tone={toneForString(environment.status)}>
          {environment.status}
        </span>
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Directory</dt>
          <dd className="directory">{environment.directory || '—'}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd className="branch">{environment.branch || '—'}</dd>
        </div>
        <div>
          <dt>Worker</dt>
          <dd className="worker-type">{environment.workerType || '—'}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd className="last-seen">{formatTime(environment.lastSeenAt)}</dd>
        </div>
      </dl>

      {hasActiveSession ? (
        <div className="card-actions card-actions-compact">
          <button
            className="button open-session"
            type="button"
            onClick={() => {
              if (environment.activeSessionId) {
                onOpenSession(environment.activeSessionId)
              }
            }}
          >
            Open active session
          </button>
        </div>
      ) : (
        <div className="inline-form create-session-form">
          <input
            className="session-title-input"
            type="text"
            placeholder="Optional session title"
            autoComplete="off"
            value={draftTitle}
            disabled={deleting}
            onChange={event => onDraftTitleChange(event.currentTarget.value)}
          />
        </div>
      )}

      <p className="hint session-hint">
        {hasActiveSession
          ? `Active session: ${environment.activeSessionId}. Open it instead of starting a second one.`
          : 'Use the primary action above to start the next session. The title here is optional.'}
      </p>
      <div className="environment-card-footer">
        <button
          className="ghost-button danger-link delete-environment"
          type="button"
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? 'Deleting…' : 'Delete environment'}
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </article>
  )
}
