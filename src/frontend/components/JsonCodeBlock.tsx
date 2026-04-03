import { useMemo, useState } from 'react'

type JsonCodeBlockProps = {
  value: unknown
  collapsedLines?: number
}

type Token = {
  text: string
  className: string
}

export function JsonCodeBlock({
  value,
  collapsedLines = 10,
}: JsonCodeBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const source = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value])
  const tokens = useMemo(() => tokenizeJson(source), [source])

  return (
    <div className="json-panel">
      <div className="json-toolbar">
        <span className="json-caption">{expanded ? 'Expanded' : 'Collapsed'} JSON</span>
        <button
          className="ghost-button json-toggle"
          type="button"
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <pre
        className={`json-block${expanded ? ' is-expanded' : ''}`}
        style={{ ['--json-collapsed-lines' as string]: String(collapsedLines) }}
      >
        <code>
          {tokens.map((token, index) => (
            <span className={token.className} key={`${index}-${token.text}`}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function tokenizeJson(source: string): Token[] {
  const tokens: Token[] = []
  const pattern =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

  let lastIndex = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, index), className: 'json-punctuation' })
    }

    const [fullMatch, quoted, keyMarker, keyword] = match
    if (quoted) {
      tokens.push({
        text: quoted,
        className: keyMarker ? 'json-key' : 'json-string',
      })
      if (keyMarker) {
        tokens.push({ text: keyMarker, className: 'json-punctuation' })
      }
    } else if (keyword === 'true' || keyword === 'false') {
      tokens.push({ text: fullMatch, className: 'json-boolean' })
    } else if (keyword === 'null') {
      tokens.push({ text: fullMatch, className: 'json-null' })
    } else {
      tokens.push({ text: fullMatch, className: 'json-number' })
    }

    lastIndex = index + fullMatch.length
  }

  if (lastIndex < source.length) {
    tokens.push({ text: source.slice(lastIndex), className: 'json-punctuation' })
  }

  return tokens
}
