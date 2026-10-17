// QFlow mark: three bars of decreasing length = a queue moving along
export default function Logo({ size = 32, withWord = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--color-brand-600)" />
        <rect x="7" y="9" width="18" height="3.5" rx="1.75" fill="#fff" />
        <rect x="7" y="14.25" width="13" height="3.5" rx="1.75" fill="#fff" opacity=".85" />
        <rect x="7" y="19.5" width="8" height="3.5" rx="1.75" fill="#fff" opacity=".7" />
      </svg>
      {withWord && <span className="font-display text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">QFlow</span>}
    </span>
  );
}
