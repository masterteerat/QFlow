import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { bkkToday, parseYmd, ymd, daysInMonth, weekdayOf, monthName, fmtDateLong, addDaysYmd } from '../lib/date';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// The calendar window that opens when the button is pressed. It is mounted fresh on every open,
// so it simply starts on the month of the current value.
function CalendarPopup({ value, min, max, enabledDates, markedDates, title, onPick, onClose }) {
  const today = bkkToday();
  const start = parseYmd(value) || parseYmd(today);
  const [view, setView] = useState({ y: start.y, m: start.m });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const minP = min ? parseYmd(min) : null;
  const maxP = max ? parseYmd(max) : null;
  const canPrev = !minP || view.y > minP.y || (view.y === minP.y && view.m > minP.m);
  const canNext = !maxP || view.y < maxP.y || (view.y === maxP.y && view.m < maxP.m);
  const go = (delta) => setView((v) => {
    const idx = v.y * 12 + (v.m - 1) + delta;
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  });

  const lead = weekdayOf(view.y, view.m, 1);
  const total = daysInMonth(view.y, view.m);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const isDisabled = (key) =>
    (min && key < min) || (max && key > max) || (enabledDates && !enabledDates.has(key));

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink-950/60 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-ink-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close calendar" className="w-9 h-9 rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 text-xl leading-none">×</button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous month"
            className="w-10 h-10 rounded-xl border border-ink-200 dark:border-ink-600 text-ink-700 dark:text-ink-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-brand-400">‹</button>
          <p className="font-extrabold text-ink-900 dark:text-white">{monthName(view.m)} {view.y}</p>
          <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="Next month"
            className="w-10 h-10 rounded-xl border border-ink-200 dark:border-ink-600 text-ink-700 dark:text-ink-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-brand-400">›</button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1">
          {DOW.map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <span key={`b${i}`} />;
            const key = ymd(view.y, view.m, d);
            const disabled = isDisabled(key);
            const selected = key === value;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-label={fmtDateLong(key)}
                aria-pressed={selected}
                onClick={() => onPick(key)}
                className={`relative h-10 rounded-xl text-sm font-bold transition-colors ${
                  selected
                    ? 'bg-brand-700 dark:bg-brand-600 text-white shadow'
                    : disabled
                    ? 'text-ink-300 dark:text-ink-600 cursor-not-allowed'
                    : 'text-ink-800 dark:text-ink-100 hover:bg-brand-50 dark:hover:bg-ink-700'
                } ${isToday && !selected ? 'ring-2 ring-brand-500/60' : ''}`}
              >
                {d}
                {markedDates?.has(key) && (
                  <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-brand-600'}`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => !isDisabled(today) && onPick(today)}
            disabled={isDisabled(today)}
            className="text-sm font-bold text-brand-700 dark:text-brand-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >Today</button>
          {markedDates && markedDates.size > 0 && (
            <span className="text-xs text-ink-500 dark:text-ink-400"><span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-600 mr-1 align-middle" />has bookings</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// A button showing the chosen date; pressing it opens the calendar.
//  value / onChange   'YYYY-MM-DD'
//  min / max          limits (inclusive), optional
//  enabledDates       Set of selectable dates (everything else greyed out), optional
//  markedDates        Set of dates to show a dot under, optional
//  showArrows         add ‹ › buttons that step to the previous / next selectable day
export default function CalendarPicker({ value, onChange, min, max, enabledDates, markedDates, title = 'Choose a date', showArrows = true, className = '' }) {
  const [open, setOpen] = useState(false);
  const today = bkkToday();

  const step = (dir) => {
    let k = value || today;
    for (let i = 0; i < 400; i++) {
      k = addDaysYmd(k, dir);
      if ((min && k < min) || (max && k > max)) return;
      if (!enabledDates || enabledDates.has(k)) { onChange(k); return; }
    }
  };
  const hasPrev = () => { let k = value || today; for (let i = 0; i < 400; i++) { k = addDaysYmd(k, -1); if (min && k < min) return false; if (!enabledDates || enabledDates.has(k)) return true; } return false; };
  const hasNext = () => { let k = value || today; for (let i = 0; i < 400; i++) { k = addDaysYmd(k, 1); if (max && k > max) return false; if (!enabledDates || enabledDates.has(k)) return true; } return false; };

  const arrowCls = 'w-11 h-11 shrink-0 rounded-xl bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-brand-400 text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showArrows && <button type="button" onClick={() => step(-1)} disabled={!hasPrev()} className={arrowCls} aria-label="Previous day">‹</button>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex-1 h-11 min-w-0 flex items-center justify-center gap-2 px-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-sm font-bold text-ink-900 dark:text-white hover:border-brand-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
      >
        <svg className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
        </svg>
        <span className="truncate">{value ? fmtDateLong(value) : 'Pick a date'}</span>
      </button>
      {showArrows && <button type="button" onClick={() => step(1)} disabled={!hasNext()} className={arrowCls} aria-label="Next day">›</button>}
      {open && (
        <CalendarPopup
          value={value}
          min={min}
          max={max}
          enabledDates={enabledDates}
          markedDates={markedDates}
          title={title}
          onPick={(k) => { onChange(k); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
