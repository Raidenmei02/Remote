import { useRef, useState, type FormEvent } from 'react'
import type { EnvironmentRecord } from '../../shared/protocol'
import { formatTime, toneForString } from '../utils/format'

type EnvironmentCardProps = {
  environment: EnvironmentRecord
  onOpenSession: (sessionId: string) => void
  onCreateSession: (environmentId: string, title: string) => Promise<void>
  onRemoveEnvironment: (environmentId: string) => Promise<void>
}

export function EnvironmentCard({
  environment,
  onOpenSession,
  onCreateSession,
  onRemoveEnvironment,
}: EnvironmentCardProps) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hasActiveSession = Boolean(environment.activeSessionId)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hasActiveSession || submitting) return

    setSubmitting(true)
    setError('')

    try {
      await onCreateSession(environment.id, title)
      setTitle('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to start session')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (submitting || deleting) return

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

      <div className="card-actions">
        <button
          className="button open-session"
          type="button"
          disabled={!hasActiveSession}
          onClick={() => {
            if (hasActiveSession && environment.activeSessionId) {
              onOpenSession(environment.activeSessionId)
            }
          }}
        >
          {hasActiveSession ? 'Open session' : 'No active session'}
        </button>
        <button
          className="button secondary create-session"
          type="button"
          disabled={deleting}
          onClick={() => {
            if (!hasActiveSession) {
              inputRef.current?.focus()
            }
          }}
        >
          {hasActiveSession ? 'Attached' : 'New draft'}
        </button>
        <button
          className="button danger delete-environment"
          type="button"
          disabled={submitting || deleting}
          onClick={() => void remove()}
        >
          {deleting ? 'Deleting…' : 'Delete environment'}
        </button>
      </div>

      <form className="inline-form create-session-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="session-title-input"
          type="text"
          placeholder="Session title"
          autoComplete="off"
          value={title}
          disabled={hasActiveSession || submitting || deleting}
          onChange={event => setTitle(event.currentTarget.value)}
        />
        <button
          className="button"
          type="submit"
          disabled={hasActiveSession || submitting || deleting}
        >
          {submitting ? 'Starting…' : 'Start'}
        </button>
      </form>

      <p className="hint session-hint">
        {hasActiveSession
          ? `Active session: ${environment.activeSessionId}. Open it instead of starting a second one.`
          : 'No active session attached.'}
      </p>
      {error ? <p className="error-text">{error}</p> : null}
    </article>
  )
}
