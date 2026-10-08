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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!loading) onCancel?.(); }}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
        {message && <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{message}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2 rounded-lg font-semibold text-white transition-colors disabled:opacity-60 ${
              danger ? 'bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-700' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
