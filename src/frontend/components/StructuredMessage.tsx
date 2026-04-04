import type { ChatMessageViewModel } from '../types'
import { formatTime } from '../utils/format'

type StructuredMessageProps = {
  entry: ChatMessageViewModel
}

export function StructuredMessage({ entry }: StructuredMessageProps) {
  const roleLabel = entry.role === 'user' ? 'You' : 'Assistant'
  const summary = entry.executionSummary

  return (
    <article className={`message ${entry.role} bubble-row structured-message`}>
      <div className="message-head">
        <strong>{roleLabel}</strong>
      </div>
      <div className="structured-blocks">
        <div className="message-body">{entry.text}</div>
        {summary ? (
          <div
            className="message-execution-summary"
            data-tone={summary.hasError ? 'bad' : 'warn'}
          >
            {summary.toolCalls ? <span>{summary.toolCalls} tool call{summary.toolCalls > 1 ? 's' : ''}</span> : null}
            {summary.toolResults ? (
              <span>{summary.toolResults} result{summary.toolResults > 1 ? 's' : ''}</span>
            ) : null}
            {summary.resultLabel ? <span>{summary.resultLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="message-meta">
        <span>#{entry.seq ?? '—'}</span>
        <span>{formatTime(entry.createdAt)}</span>
      </div>
    </article>
  )
}
