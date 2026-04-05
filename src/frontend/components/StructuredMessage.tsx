import { useMemo, useState } from 'react'
import { JsonCodeBlock } from './JsonCodeBlock'
import type { StructuredMessageBlock, StructuredMessageGroup } from '../types'
import { formatTime } from '../utils/format'

type StructuredMessageProps = {
  group: StructuredMessageGroup
}

type ToolRun = {
  id: string
  toolName: string
  command: string
  input?: Record<string, unknown>
  result?: Extract<StructuredMessageBlock, { kind: 'tool_result' }>
}

export function StructuredMessage({ group }: StructuredMessageProps) {
  const roleLabel =
    group.role === 'user'
      ? 'You'
      : group.role === 'assistant'
        ? 'Assistant'
        : group.role === 'result'
          ? 'Result'
          : 'System'

  const seqLabel =
    group.seqStart === group.seqEnd ? `#${group.seqStart ?? '—'}` : `#${group.seqStart}-${group.seqEnd}`

  return (
    <article className={`message ${group.role} bubble-row structured-message`}>
      <div className="message-head">
        <strong>{roleLabel}</strong>
      </div>
      <GroupBody group={group} />
      <div className="message-meta">
        <span>{seqLabel}</span>
        <span>{formatTime(group.createdAt)}</span>
      </div>
    </article>
  )
}

function GroupBody({ group }: { group: StructuredMessageGroup }) {
  if (group.role === 'assistant') {
    return <AssistantGroupBody group={group} />
  }

  return (
    <div className="structured-blocks">
      {group.blocks.map((block, index) => (
        <StructuredBlock block={block} key={`${group.id}:${block.kind}:${index}`} />
      ))}
    </div>
  )
}

function AssistantGroupBody({ group }: { group: StructuredMessageGroup }) {
  const contentBlocks = group.blocks.filter(
    block => block.kind !== 'tool_use' && block.kind !== 'tool_result',
  )
  const toolRuns = useMemo(() => buildToolRuns(group.blocks), [group.blocks])
  const hasConclusion = contentBlocks.length > 0
  const [processMode, setProcessMode] = useState<'collapsed' | 'preview' | 'expanded'>(
    hasConclusion ? 'collapsed' : 'preview',
  )
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  return (
    <div className="structured-blocks assistant-group-blocks">
      {toolRuns.length ? (
        <section className="process-panel">
          <button
            className="process-toggle"
            type="button"
            onClick={() =>
              setProcessMode(current =>
                current === 'expanded' ? (hasConclusion ? 'collapsed' : 'preview') : 'expanded',
              )
            }
            aria-expanded={processMode === 'expanded'}
          >
            <div className="process-toggle-copy">
              <span className="structured-card-label">Process</span>
              <span className="process-toggle-summary">
                {toolRuns.length} command{toolRuns.length > 1 ? 's' : ''}
                {!hasConclusion && processMode === 'preview' ? ' · preview' : ''}
              </span>
            </div>
            <span className="terminal-caret">{processMode === 'expanded' ? '−' : '+'}</span>
          </button>
          {processMode !== 'collapsed' ? (
            <div
              className={`process-list${processMode === 'preview' ? ' is-preview' : ''}`}
            >
              {toolRuns.map(run => (
                <ToolRunCard
                  key={run.id}
                  run={run}
                  expanded={expandedRunId === run.id}
                  onToggle={() =>
                    setExpandedRunId(current => (current === run.id ? null : run.id))
                  }
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {contentBlocks.length ? (
        <div className="assistant-conclusion">
          {contentBlocks.map((block, index) => (
            <StructuredBlock block={block} key={`${group.id}:content:${block.kind}:${index}`} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StructuredBlock({ block }: { block: StructuredMessageBlock }) {
  switch (block.kind) {
    case 'text':
      return <div className="message-body">{block.text}</div>
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
    case 'tool_use':
    case 'tool_result':
      return null
  }
}

function ToolRunCard({
  run,
  expanded,
  onToggle,
}: {
  run: ToolRun
  expanded: boolean
  onToggle: () => void
}) {
  const [outputExpanded, setOutputExpanded] = useState(false)
  const tone = run.result?.isError ? 'bad' : 'good'
  const output = run.result
    ? run.result.stdout || run.result.stderr || run.result.content || 'No output'
    : ''

  return (
    <div
      className="terminal-card tool-run-card"
      data-tone={run.result ? tone : undefined}
      data-status={run.result ? tone : 'pending'}
    >
      <button
        className="terminal-row terminal-row-button process-run-toggle"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="terminal-row-main">
          <span className="terminal-prefix">$</span>
          <span className="terminal-command">{run.command}</span>
        </div>
        <div className="terminal-row-meta">
          <span className="mini-pill">{run.toolName || 'Tool'}</span>
          {run.result ? (
            <span className="mini-pill" data-tone={tone}>
              {run.result.isError ? 'error' : 'ok'}
            </span>
          ) : null}
          <span className="terminal-caret">{expanded ? '−' : '+'}</span>
        </div>
      </button>

      {expanded ? (
        output ? (
          <div className="terminal-detail tool-run-detail">
            <pre className={`tool-output-block tool-output-block-inline${outputExpanded ? ' is-expanded' : ''}`}>
              {output}
            </pre>
            {output.length > 220 ? (
              <button
                className="ghost-button process-detail-toggle"
                type="button"
                onClick={() => setOutputExpanded(current => !current)}
                aria-expanded={outputExpanded}
              >
                {outputExpanded ? 'Show less output' : 'Show full output'}
              </button>
            ) : null}
            {run.input ? <JsonCodeBlock value={run.input} collapsedLines={6} /> : null}
            {run.result ? (
              <div className="tool-flags">
                {run.result.interrupted ? <span>Interrupted</span> : null}
                {run.result.isImage ? <span>Image output</span> : null}
                {run.result.stderr ? <span>Has stderr</span> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="tool-output-empty">Waiting for output</div>
        )
      ) : null}
    </div>
  )
}

function ResultSummaryCard({
  block,
}: {
  block: Extract<StructuredMessageBlock, { kind: 'result' }>
}) {
  const [expanded, setExpanded] = useState(false)
  const tone = block.subtype === 'success' ? 'good' : 'bad'
  const summary = block.text || 'No result summary available.'
  const brief = summary.length > 88 ? `${summary.slice(0, 88)}…` : summary

  return (
    <div className="structured-card result-card" data-tone={tone}>
      <button
        className="result-toggle"
        type="button"
        onClick={() => setExpanded(current => !current)}
        aria-expanded={expanded}
      >
        <div className="structured-card-head">
          <div className="result-toggle-copy">
            <span className="structured-card-label">Run summary</span>
            <span className="result-toggle-summary">{brief}</span>
          </div>
          <div className="result-toggle-meta">
            <span className="mini-pill" data-tone={tone}>
              {block.subtype === 'success' ? 'completed' : block.subtype || 'result'}
            </span>
            <span className="terminal-caret">{expanded ? '−' : '+'}</span>
          </div>
        </div>
      </button>
      {!expanded ? (
        <div className="result-stats result-stats-compact">
          <span>{block.durationMs ? `${block.durationMs} ms` : '—'}</span>
          <span>{block.durationApiMs ? `API ${block.durationApiMs} ms` : 'API —'}</span>
          <span>
            {typeof block.costUsd === 'number' ? `$${block.costUsd.toFixed(4)}` : 'Cost —'}
          </span>
        </div>
      ) : (
        <>
          <div className="message-body">{summary}</div>
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
        </>
      )}
    </div>
  )
}

function buildToolRuns(blocks: StructuredMessageBlock[]): ToolRun[] {
  const runs: ToolRun[] = []

  for (const block of blocks) {
    if (block.kind === 'tool_use') {
      runs.push({
        id: block.toolCallId || `tool-${runs.length}`,
        toolName: block.toolName,
        command:
          typeof block.input.command === 'string'
            ? block.input.command
            : `${block.toolName || 'tool'} ${Object.keys(block.input).length ? 'input' : 'run'}`,
        input: block.input,
      })
      continue
    }

    if (block.kind === 'tool_result') {
      const pending = [...runs].reverse().find(
        item => !item.result && (!block.toolUseId || item.id === block.toolUseId),
      )

      if (pending) {
        pending.result = block
      } else {
        runs.push({
          id: block.toolUseId || `tool-result-${runs.length}`,
          toolName: 'Tool',
          command: 'output',
          result: block,
        })
      }
    }
  }

  return runs
}
