// Icon-only back button (chevron). Uses the shared .icon-button class.
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="icon-button" aria-label="Back" onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  )
}
