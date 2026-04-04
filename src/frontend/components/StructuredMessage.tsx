import { useState } from 'react'
import { JsonCodeBlock } from './JsonCodeBlock'
import type { StructuredMessageBlock, StructuredSessionEntry } from '../types'
import { formatTime } from '../utils/format'

type StructuredMessageProps = {
  entry: StructuredSessionEntry
}

export function StructuredMessage({ entry }: StructuredMessageProps) {
  const roleLabel =
    entry.role === 'user'
      ? 'You'
      : entry.role === 'assistant'
        ? 'Assistant'
        : entry.role === 'result'
          ? 'Result'
          : 'System'

  return (
    <article className={`message ${entry.role} bubble-row structured-message`}>
      <div className="message-head">
        <strong>{roleLabel}</strong>
      </div>
      <div className="structured-blocks">
        {entry.blocks.map((block, index) => (
          <StructuredBlock block={block} key={`${entry.id}:${block.kind}:${index}`} />
        ))}
      </div>
      <div className="message-meta">
        <span>#{entry.seq ?? '—'}</span>
        <span>{formatTime(entry.createdAt)}</span>
      </div>
    </article>
  )
}

function StructuredBlock({ block }: { block: StructuredMessageBlock }) {
  switch (block.kind) {
    case 'text':
      return <div className="message-body">{block.text}</div>
    case 'tool_use':
      return <ToolUseCard block={block} />
    case 'tool_result':
      return <ToolResultCard block={block} />
    case 'result':
      return <ResultSummaryCard block={block} />
    case 'status':
      return (
        <div className="structured-card status-card">
          <span className="structured-card-label">{block.label}</span>
          <strong>{block.value}</strong>
        </div>
      )
    case 'json':
      return (
        <div className="structured-card json-card">
          <span className="structured-card-label">{block.label}</span>
          <JsonCodeBlock value={block.value} collapsedLines={8} />
        </div>
      )
  }
}

function ToolUseCard({
  block,
}: {
  block: Extract<StructuredMessageBlock, { kind: 'tool_use' }>
}) {
  return (
    <div className="structured-card tool-card tool-use-card">
      <div className="structured-card-head">
        <span className="structured-card-label">Tool call</span>
        <span className="mini-pill">{block.toolName || 'Tool'}</span>
      </div>
      <div className="tool-command-preview">
        {typeof block.input.command === 'string'
          ? block.input.command
          : `${block.toolName} input`}
      </div>
      <JsonCodeBlock value={block.input} collapsedLines={6} />
    </div>
  )
}

function ToolResultCard({
  block,
}: {
  block: Extract<StructuredMessageBlock, { kind: 'tool_result' }>
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = block.stdout || block.stderr || block.content || 'No output'
  const tone = block.isError ? 'bad' : 'good'

  return (
    <div className={`structured-card tool-card tool-result-card`} data-tone={tone}>
      <div className="structured-card-head">
        <span className="structured-card-label">Tool result</span>
        <span className="mini-pill" data-tone={tone}>
          {block.isError ? 'error' : 'ok'}
        </span>
      </div>
      <div className="tool-result-summary">
        {block.toolUseId ? `Call ${block.toolUseId}` : 'Tool output'}
      </div>
      <pre className={`tool-output-block${expanded ? ' is-expanded' : ''}`}>
        {preview}
      </pre>
      <div className="tool-flags">
        {block.interrupted ? <span>Interrupted</span> : null}
        {block.isImage ? <span>Image output</span> : null}
        {block.stderr ? <span>Has stderr</span> : null}
      </div>
      {preview.length > 280 ? (
        <button
          className="ghost-button json-toggle"
          type="button"
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? 'Collapse output' : 'Expand output'}
        </button>
      ) : null}
    </div>
  )
}

function ResultSummaryCard({
  block,
}: {
  block: Extract<StructuredMessageBlock, { kind: 'result' }>
}) {
  const tone = block.subtype === 'success' ? 'good' : 'bad'

  return (
    <div className="structured-card result-card" data-tone={tone}>
      <div className="structured-card-head">
        <span className="structured-card-label">Turn result</span>
        <span className="mini-pill" data-tone={tone}>
          {block.subtype || 'result'}
        </span>
      </div>
      <div className="message-body">{block.text || 'No result summary available.'}</div>
      <div className="result-stats">
        <span>{block.durationMs ? `${block.durationMs} ms` : '—'}</span>
        <span>{block.durationApiMs ? `API ${block.durationApiMs} ms` : 'API —'}</span>
        <span>
          {typeof block.costUsd === 'number' ? `$${block.costUsd.toFixed(4)}` : 'Cost —'}
        </span>
      </div>
      {block.stopReason ? (
        <div className="tool-flags">
          <span>stop: {block.stopReason}</span>
        </div>
      ) : null}
      {block.usage ? <JsonCodeBlock value={block.usage} collapsedLines={6} /> : null}
    </div>
  )
}
