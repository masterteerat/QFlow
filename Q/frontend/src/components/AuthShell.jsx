import Logo from './Logo';

const COPY = {
  customer: {
    kicker: 'For customers',
    headline: 'Skip the wait,\nnot the experience.',
    body: 'Book a time slot or join a walk-in queue, then watch your place move up from anywhere.'
  },
  owner: {
    kicker: 'For shop owners',
    headline: 'Your queue,\nunder control.',
    body: 'Scan tickets, check customers in, and see your whole day at a glance - no more clipboards.'
  }
};

// A decorative, non-interactive ticket used on the brand panel
function DemoTicket({ className = '', faded = false }) {
  return (
    <div className={`w-72 rounded-2xl bg-white text-ink-900 shadow-xl p-5 ${faded ? 'opacity-60' : ''} ${className}`} aria-hidden="true">
      <div className="flex items-center justify-between text-xs font-bold text-ink-500">
        <span>Sunrise Barber</span>
        <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">Waiting</span>
      </div>
      <div className="qnum text-5xl mt-3 text-ink-900">A014</div>
      <div className="perf my-4" />
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-brand-700">3 ahead of you</span>
        <span className="text-ink-500 font-semibold">~ 12 min</span>
      </div>
    </div>
  );
}

export default function AuthShell({ variant = 'customer', title, subtitle, children }) {
  const c = COPY[variant];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] bg-ink-50 dark:bg-ink-900">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 bg-ink-900 text-white">
        <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-brand-600/25 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative [&_span.font-display]:!text-white"><Logo size={36} /></div>

        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-300 mb-4">{c.kicker}</p>
          <h1 className="font-display text-5xl xl:text-6xl font-extrabold leading-[1.02] whitespace-pre-line">{c.headline}</h1>
          <p className="mt-5 text-ink-300 text-lg leading-relaxed">{c.body}</p>
        </div>

        <div className="relative h-56">
          <DemoTicket faded className="absolute left-16 top-0 rotate-[5deg]" />
          <DemoTicket className="absolute left-0 top-6 -rotate-[4deg]" />
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="auth-card w-full max-w-md mx-auto">
          <div className="lg:hidden mb-8"><Logo size={34} /></div>
          <h2 className="font-display text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 text-ink-500 dark:text-ink-400">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
