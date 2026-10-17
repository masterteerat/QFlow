import { useEffect } from 'react';

// In-app replacement for window.confirm(). Rendered inside the page so it follows the site's theme.
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep it',
  loading = false,
  danger = true,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!loading) onCancel?.(); }}
    >
      <div
        className="bg-white dark:bg-ink-800 rounded-3xl shadow-xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-ink-800 dark:text-white mb-2">{title}</h3>
        {message && <p className="text-ink-500 dark:text-ink-400 mb-6 text-sm">{message}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-bold bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-60 ${
              danger ? 'bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-700' : 'bg-brand-700 hover:bg-brand-800'
            }`}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
