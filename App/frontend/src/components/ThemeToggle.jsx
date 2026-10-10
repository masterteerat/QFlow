import { useState, useEffect } from 'react';

// Light/dark switch. `floating` = fixed in the bottom-right corner (only used on login/sign-up pages,
// which have no navbar). Everywhere else it sits inside the navbar so it never covers page content.
export default function ThemeToggle({ floating = false }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const base = 'rounded-full flex items-center justify-center transition-colors';
  const look = floating
    ? 'fixed bottom-6 right-6 p-3 bg-ink-800 dark:bg-amber-400 text-amber-400 dark:text-ink-900 shadow-xl hover:scale-110 z-50'
    : 'w-10 h-10 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-amber-300 hover:border-brand-400';

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      className={`${base} ${look}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
}
