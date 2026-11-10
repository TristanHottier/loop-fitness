import './empty-state.css'

// Empty state per design-v2: the infinity line at low opacity and one sentence.
export function EmptyState({ children }: { children: string }) {
  return (
    <div className="empty-state">
      <svg className="empty-state-logo" viewBox="0 0 100 50" aria-hidden="true">
        <path
          d="M50,25 C50,8 18,8 18,25 C18,42 50,42 50,25 C50,8 82,8 82,25 C82,42 50,42 50,25 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="empty-state-text">{children}</p>
    </div>
  )
}
