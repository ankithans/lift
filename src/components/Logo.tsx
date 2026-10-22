/** Lift mark: a barbell plate stack rising — three bars, ascending. */
export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="Lift">
      <rect width="32" height="32" rx="9" fill="#B8F4D0" />
      <rect x="7.5" y="17" width="4" height="8" rx="2" fill="#07110B" />
      <rect x="14" y="12" width="4" height="13" rx="2" fill="#07110B" />
      <rect x="20.5" y="7" width="4" height="18" rx="2" fill="#07110B" />
    </svg>
  )
}
