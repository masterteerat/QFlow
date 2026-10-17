// Small shared pieces for the "ticket" look

// Dashed tear-off line with notches on both card edges. Place inside a card that has p-5 or p-6 padding.
export function Perf({ pad = 'p-6' }) {
  const m = pad === 'p-5' ? '-mx-5' : '-mx-6';
  const inset = pad === 'p-5' ? 'mx-5' : 'mx-6';
  return (
    <div className={`relative ${m} my-5`} aria-hidden="true">
      <div className={`perf ${inset}`} />
      <i className="notch -left-3" />
      <i className="notch -right-3" />
    </div>
  );
}

const PILL = {
  Waiting: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
  Serving: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  Completed: 'bg-ink-100 text-ink-700 dark:bg-ink-700 dark:text-ink-200',
  Cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
};
const PILL_LABEL = { Serving: 'Checked in' };

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${PILL[status] || PILL.Completed}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {PILL_LABEL[status] || status}
    </span>
  );
}
