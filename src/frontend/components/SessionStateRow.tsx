import { useState } from 'react'
import { truncateText } from '../utils/format'

type SessionStateRowProps = {
  label: string
  value: string
  truncate?: number
}

export function SessionStateRow({
  label,
  value,
  truncate,
}: SessionStateRowProps) {
  const [expanded, setExpanded] = useState(false)
  const previewValue = typeof truncate === 'number' ? truncateText(value, truncate) : value
  const isCollapsible = previewValue !== value

  return (
    <button className="state-item" type="button" onClick={() => setExpanded(current => !current)}>
      <span className="state-key">{label}</span>
      <span
        className={`state-value${isCollapsible ? ' is-collapsible' : ''}${
          expanded ? ' is-expanded' : ''
        }`}
        aria-expanded={expanded ? 'true' : 'false'}
        title={isCollapsible ? 'Click to expand' : value}
      >
        {expanded ? value : previewValue}
      </span>
    </button>
  )
}
