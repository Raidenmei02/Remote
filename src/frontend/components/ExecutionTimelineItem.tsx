import { useState } from 'react'
import type { ExecutionTimelineItemViewModel } from '../types'
import { formatTime } from '../utils/format'
import { JsonCodeBlock } from './JsonCodeBlock'

type ExecutionTimelineItemProps = {
  item: ExecutionTimelineItemViewModel
}

export function ExecutionTimelineItem({
  item,
}: ExecutionTimelineItemProps) {
  const [expanded, setExpanded] = useState(!item.collapsedByDefault)

  return (
    <article className="execution-item" data-tone={item.tone || 'warn'}>
      <div className="execution-item-head">
        <div>
          <p className="execution-item-label">{item.kind.replace('_', ' ')}</p>
          <h4>{item.title}</h4>
        </div>
        <div className="execution-item-meta">
          <span className="mini-pill" data-tone={item.tone || 'warn'}>
            #{item.seq}
          </span>
          <span>{formatTime(item.createdAt)}</span>
        </div>
      </div>

      <p className="execution-item-summary">{item.summary}</p>

      {renderCompactStats(item)}

      {needsExpansion(item) ? (
        <button
          className="ghost-button execution-toggle"
          type="button"
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? 'Collapse details' : 'Expand details'}
        </button>
      ) : null}

      {expanded ? <ExecutionDetails item={item} /> : null}
    </article>
  )
}

function renderCompactStats(item: ExecutionTimelineItemViewModel) {
  if (item.kind === 'tool_result') {
    return (
      <div className="execution-tags">
        {item.toolUseId ? <span>call {item.toolUseId}</span> : null}
        {item.isError ? <span>error</span> : <span>ok</span>}
        {item.interrupted ? <span>interrupted</span> : null}
        {item.isImage ? <span>image</span> : null}
      </div>
    )
  }

  if (item.kind === 'result') {
    return (
      <div className="execution-tags">
        <span>{item.subtype || 'result'}</span>
        <span>{item.durationMs ? `${item.durationMs} ms` : 'duration —'}</span>
        <span>{typeof item.costUsd === 'number' ? `$${item.costUsd.toFixed(4)}` : 'cost —'}</span>
      </div>
    )
  }

  return null
}

function needsExpansion(item: ExecutionTimelineItemViewModel) {
  if (item.kind === 'tool_use') return true
  if (item.kind === 'tool_result') return Boolean(item.stdout || item.stderr || item.content)
  if (item.kind === 'result') return Boolean(item.usage || item.stopReason || item.text)
  return true
}

function ExecutionDetails({ item }: { item: ExecutionTimelineItemViewModel }) {
  switch (item.kind) {
    case 'tool_use':
      return (
        <div className="execution-details">
          {item.command ? <pre className="tool-output-block">{item.command}</pre> : null}
          <JsonCodeBlock value={item.input} collapsedLines={6} />
        </div>
      )
    case 'tool_result':
      return (
        <div className="execution-details">
          {item.stdout ? <pre className="tool-output-block">{item.stdout}</pre> : null}
          {item.stderr ? <pre className="tool-output-block has-error">{item.stderr}</pre> : null}
          {!item.stdout && !item.stderr && item.content ? (
            <pre className="tool-output-block">{item.content}</pre>
          ) : null}
          <JsonCodeBlock value={item.raw} collapsedLines={6} />
        </div>
      )
    case 'result':
      return (
        <div className="execution-details">
          {item.text ? <div className="message-body">{item.text}</div> : null}
          {item.stopReason ? (
            <div className="execution-tags">
              <span>stop: {item.stopReason}</span>
              <span>{item.durationApiMs ? `api ${item.durationApiMs} ms` : 'api —'}</span>
            </div>
          ) : null}
          {item.usage ? <JsonCodeBlock value={item.usage} collapsedLines={6} /> : null}
          <JsonCodeBlock value={item.raw} collapsedLines={8} />
        </div>
      )
    case 'status':
    case 'json':
      return (
        <div className="execution-details">
          <JsonCodeBlock value={item.raw} collapsedLines={8} />
        </div>
      )
  }
}
