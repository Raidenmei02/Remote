type TopbarProps = {
  baseUrl: string
  onBaseUrlChange: (value: string) => void
  onBaseUrlCommit: (value: string) => void
  onRefresh: () => void
}

export function Topbar({
  baseUrl,
  onBaseUrlChange,
  onBaseUrlCommit,
  onRefresh,
}: TopbarProps) {
  void baseUrl
  void onBaseUrlChange
  void onBaseUrlCommit

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="eyebrow">Remote Control</p>
        <h1>Remote Console</h1>
        <p className="topbar-subtitle">Remote session workspace</p>
      </div>
      <div className="toolbar">
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          title="Refresh"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
