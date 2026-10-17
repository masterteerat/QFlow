import { useEffect, useState, useCallback, useMemo } from 'react';
import { bkkToday } from '../lib/date';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import BanNotice from '../components/BanNotice';
import { useToast } from '../context/ToastContext';

const HOUR_HEIGHT = 64;


const STATUS_COLORS = {
  Waiting:   { bg: 'bg-brand-600',   border: 'border-brand-700',   text: 'text-white' },
  Serving:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
  Completed: { bg: 'bg-ink-400',   border: 'border-ink-500',   text: 'text-white' },
  Cancelled: { bg: 'bg-rose-300',    border: 'border-rose-400',    text: 'text-rose-900' }
};

const toDateKey = (d) => {
  // 'YYYY-MM-DD' strings from the API are already Bangkok dates: don't re-parse them as UTC
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseMinutes = (hhmmss) => {
  if (!hhmmss || hhmmss === '-') return 0;
  const parts = String(hhmmss).split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
};

const formatDateKey = (dateKey) => {
  if (!dateKey || dateKey.length !== 10) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  return date;
};

const shiftDate = (dateKey, days) => {
  const d = formatDateKey(dateKey) || new Date();
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

const formatDayChip = (dateKey) => {
  const date = formatDateKey(dateKey);
  if (!date) return { top: '?', bottom: '??', weekday: '?' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);
  const top = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
  return { top, bottom: `${date.getDate()}/${date.getMonth() + 1}`, weekday: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) };
};

function assignLanes(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const laneEnds = [];
  sorted.forEach((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(ev.endMin); }
    else { laneEnds[lane] = ev.endMin; }
    ev.lane = lane;
  });
  const totalLanes = Math.max(1, laneEnds.length);
  sorted.forEach((ev) => { ev.totalLanes = totalLanes; });
  return sorted;
}

export default function MySchedule() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState(bkkToday());
  const [activeTicket, setActiveTicket] = useState(null);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [dailyHour, setDailyHour] = useState(8);
  const [queueOptIn, setQueueOptIn] = useState(false);
  const [reminderHours, setReminderHours] = useState(1);
  const [optInLoading, setOptInLoading] = useState(false);

  // One helper for all three settings (daily switch, queue-reminder switch, hours).
  const savePreference = async (changes) => {
    setOptInLoading(true);
    try {
      const result = await api.patch('/customer/notification-preference', changes);
      if (result.success) {
        setEmailOptIn(!!result.email_notifications_opt_in);
        setDailyHour(Number.isInteger(result.daily_email_hour) ? result.daily_email_hour : 8);
        setQueueOptIn(!!result.queue_reminder_opt_in);
        setReminderHours(Number(result.reminder_hours_before) || 1);
        toast.success('Preference saved');
      } else {
        toast.error(result.message || 'Failed to update preference');
      }
    } catch (error) {
      console.error('Update preference error:', error);
      toast.error('Could not reach the server.');
    } finally {
      setOptInLoading(false);
    }
  };

  const customer = getCustomer();
  const customerId = customer?.id;
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!customerId) { setErrorMsg('Please log in again.'); setLoading(false); return; }
    try {
      const data = await api.get(`/customer/tickets/${customerId}`);
      if (data.success) { setTickets(data.data); setErrorMsg(''); }
      else { setErrorMsg(data.message || 'Could not load your schedule.'); }
    } catch (error) {
      console.error('Fetch schedule error:', error);
      setErrorMsg('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchTickets();
    // Fetch email notification preference
    if (customer?.id) {
      api.get('/customer/notification-preference').then((res) => {
        if (res.success) {
          setEmailOptIn(!!res.email_notifications_opt_in);
          setDailyHour(Number.isInteger(res.daily_email_hour) ? res.daily_email_hour : 8);
          setQueueOptIn(!!res.queue_reminder_opt_in);
          setReminderHours(Number(res.reminder_hours_before) || 1);
        }
      });
    }
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [customer?.id, fetchTickets]);

  // Cancel goes through an in-app confirm popup instead of window.confirm
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = (ticketId) => {
    if (!customer?.id) return toast.error('Please log in again.');
    setCancelId(ticketId);
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const result = await api.patch(`/customer/tickets/${cancelId}/cancel`);
      if (result.success) { toast.success('Ticket cancelled'); setActiveTicket(null); fetchTickets(); }
      else { toast.error(result.message); }
    } catch (error) {
      console.error('Cancel ticket error:', error);
      toast.error('Could not reach the server.');
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  const timedTickets = tickets.filter((t) => t.start_time !== '-');
  const walkinTickets = tickets.filter((t) => t.start_time === '-');

  const today = bkkToday();

  const datesWithBookings = useMemo(() => {
    const set = new Set();
    timedTickets.forEach((t) => set.add(toDateKey(t.date)));
    return set;
  }, [timedTickets]);

  const ticketsByDate = useMemo(() => {
    const map = {};
    timedTickets.forEach((t) => {
      const key = toDateKey(t.date);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [timedTickets]);

  // Count timed bookings AND walk-in tickets for today (walk-ins used to be missed, so the banner
  // said "No queues scheduled" while a walk-in ticket was listed right below it).
  const isActive = (t) => ['Waiting', 'Serving'].includes(t.status_name);
  const todaysActiveCount =
    (ticketsByDate[today] || []).filter(isActive).length +
    walkinTickets.filter((t) => isActive(t) && (!t.date || toDateKey(t.date) === today)).length;

  const dayTickets = useMemo(() => ticketsByDate[selectedDate] || [], [ticketsByDate, selectedDate]);

  const events = useMemo(() => {
    const withMinutes = dayTickets.map((t) => ({
      ...t,
      startMin: parseMinutes(t.start_time),
      endMin: parseMinutes(t.end_time)
    })).filter((t) => t.startMin > 0 || t.endMin > 0);
    return assignLanes(withMinutes);
  }, [dayTickets]);

  const gridStartHour = events.length ? Math.min(8, ...events.map((e) => Math.floor(e.startMin / 60))) : 8;
  const gridEndHour = events.length ? Math.max(21, ...events.map((e) => Math.ceil(e.endMin / 60))) : 21;
  const hours = [];
  for (let h = gridStartHour; h <= gridEndHour; h++) hours.push(h);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 dark:bg-ink-900 transition-colors duration-300">
        <Navbar userName={customer?.fname} />
        <div className="max-w-4xl mx-auto p-5 text-center text-ink-400 dark:text-ink-500">Loading your schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar userName={customer?.fname} />
      <BanNotice />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">Schedule</h1>
        </div>

        {/* Email notification toggle */}
        {customer?.id && (
          <details className="group mb-5 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-2xl overflow-hidden">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
              <span className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
                </span>
                <span>
                  <span className="block font-bold text-ink-900 dark:text-white leading-tight">Email reminders</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">Daily summary: {emailOptIn ? 'on' : 'off'} · Before my slot: {queueOptIn ? 'on' : 'off'}</span>
                </span>
              </span>
              <svg className="w-5 h-5 text-ink-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </summary>
          <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2">
            {/* 1) Daily schedule e-mail */}
            <div className={`p-4 rounded-lg border transition-colors duration-300 ${
              emailOptIn
                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-600 text-brand-800 dark:text-brand-300'
                : 'bg-ink-50 dark:bg-ink-700 border-ink-200 dark:border-ink-600 text-ink-700 dark:text-ink-300'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOptIn}
                  disabled={optInLoading}
                  onChange={(e) => savePreference({ email_notifications_opt_in: e.target.checked })}
                  className="mt-1 w-5 h-5 accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                <span>
                  <span className="block font-medium text-ink-800 dark:text-white">
                    Daily schedule email ({emailOptIn ? 'ON' : 'OFF'})
                  </span>
                  <span className="block text-sm text-ink-500 dark:text-ink-400">
                    A daily list of your upcoming bookings.
                  </span>
                </span>
              </label>
              {emailOptIn && (
                <div className="flex items-center gap-2 mt-3 ml-8 text-sm">
                  <label htmlFor="daily-hour" className="text-ink-600 dark:text-ink-300">Send it at</label>
                  <select
                    id="daily-hour"
                    value={dailyHour}
                    disabled={optInLoading}
                    onChange={(e) => savePreference({ daily_email_hour: Number(e.target.value) })}
                    className="rounded-md border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-800 dark:text-white px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-ink-600 dark:text-ink-300">(Bangkok time)</span>
                </div>
              )}
            </div>

            {/* 2) Reminder before the queue, with customer-chosen hours */}
            <div className={`p-4 rounded-lg border transition-colors duration-300 ${
              queueOptIn
                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-600 text-brand-800 dark:text-brand-300'
                : 'bg-ink-50 dark:bg-ink-700 border-ink-200 dark:border-ink-600 text-ink-700 dark:text-ink-300'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={queueOptIn}
                  disabled={optInLoading}
                  onChange={(e) => savePreference({ queue_reminder_opt_in: e.target.checked })}
                  className="mt-1 w-5 h-5 accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                <span>
                  <span className="block font-medium text-ink-800 dark:text-white">
                    Reminder before my queue ({queueOptIn ? 'ON' : 'OFF'})
                  </span>
                  <span className="block text-sm text-ink-500 dark:text-ink-400">
                    One email shortly before your booked slot starts.
                  </span>
                </span>
              </label>
              {queueOptIn && (
                <div className="flex items-center gap-2 mt-3 ml-8 text-sm">
                  <label htmlFor="reminder-hours" className="text-ink-600 dark:text-ink-300">Remind me</label>
                  <select
                    id="reminder-hours"
                    value={reminderHours}
                    disabled={optInLoading}
                    onChange={(e) => savePreference({ reminder_hours_before: Number(e.target.value) })}
                    className="rounded-md border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-800 dark:text-white px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {[1, 2, 3, 6, 12, 24].map((h) => (
                      <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>
                    ))}
                  </select>
                  <span className="text-ink-600 dark:text-ink-300">before</span>
                </div>
              )}
            </div>
            {optInLoading && (
              <span className="text-xs text-ink-400 dark:text-ink-500 sm:col-span-2">Updating...</span>
            )}
          </div>
          </details>
        )}

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-lg border border-rose-200 dark:border-rose-800 mb-4">
            {errorMsg}
          </div>
        )}

        <div className={`mb-5 p-4 rounded-2xl border flex items-center gap-3 ${
          todaysActiveCount > 0
            ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200'
            : 'bg-ink-100 dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400'
        }`}>
          <span className="text-xl">🔔</span>
          <span className="font-semibold text-sm">
            {todaysActiveCount > 0
              ? `You have ${todaysActiveCount} queue${todaysActiveCount > 1 ? 's' : ''} today.`
              : 'No queues scheduled for today.'}
          </span>
        </div>

        {/* Date picker (native OS calendar) */}
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="w-11 h-11 rounded-xl bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-brand-400 text-lg font-bold"
            aria-label="Previous day"
          >
            &lt;
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="flex-1 h-11 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 dark:text-white rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:[color-scheme:dark]"
          />

          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="w-11 h-11 rounded-xl bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-brand-400 text-lg font-bold"
            aria-label="Next day"
          >
            &gt;
          </button>

          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              className="h-11 px-4 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200 hover:bg-brand-200 dark:hover:bg-brand-900/60 text-sm font-bold"
            >
              Today
            </button>
          )}
        </div>

        {datesWithBookings.has(selectedDate) && (
          <p className="text-xs text-brand-600 dark:text-brand-400 mb-4">● You have bookings on this day</p>
        )}

        {/* Time grid */}
        <div className="border border-ink-200 dark:border-ink-700 rounded-2xl bg-white dark:bg-ink-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-700">
            <h3 className="font-bold text-ink-800 dark:text-white">
              {formatDayChip(selectedDate).weekday}
            </h3>
          </div>

          {events.length === 0 ? (
            <p className="text-center text-ink-400 dark:text-ink-500 py-10">No timed bookings on this day.</p>
          ) : (
            <div className="relative flex" style={{ height: (gridEndHour - gridStartHour) * HOUR_HEIGHT }}>
              <div className="w-16 shrink-0 relative">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 text-right pr-2 text-xs text-ink-400 dark:text-ink-500"
                    style={{ top: (h - gridStartHour) * HOUR_HEIGHT - 7 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              <div className="relative flex-1 border-l border-ink-100 dark:border-ink-700">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-ink-100 dark:border-ink-700"
                    style={{ top: (h - gridStartHour) * HOUR_HEIGHT }}
                  />
                ))}

                {events.map((ev) => {
                  const colors = STATUS_COLORS[ev.status_name] || STATUS_COLORS.Completed;
                  const top = (ev.startMin - gridStartHour * 60) / 60 * HOUR_HEIGHT;
                  const height = Math.max(28, (ev.endMin - ev.startMin) / 60 * HOUR_HEIGHT);
                  const widthPct = 100 / ev.totalLanes;
                  return (
                    <button
                      key={ev.ticket_id}
                      onClick={() => setActiveTicket(ev)}
                      className={`absolute rounded-lg px-2 py-1 text-left text-xs shadow-sm border overflow-hidden hover:opacity-90 transition-opacity ${colors.bg} ${colors.border} ${colors.text}`}
                      style={{ top, height, left: `${ev.lane * widthPct}%`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <div className="font-bold truncate">{ev.business_name}</div>
                      <div className="truncate opacity-90">{ev.start_time?.slice(0, 5)}-{ev.end_time?.slice(0, 5)}</div>
                      <div className="truncate opacity-90 qnum text-[11px]">{ev.queue_number}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {walkinTickets.filter((t) => ['Waiting', 'Serving'].includes(t.status_name)).length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-ink-700 dark:text-ink-300 mb-2">Walk-in queues (no fixed time)</h4>
            <div className="flex flex-col gap-2">
              {walkinTickets
                .filter((t) => ['Waiting', 'Serving'].includes(t.status_name))
                .map((t) => (
                  <button
                    key={t.ticket_id}
                    onClick={() => setActiveTicket(t)}
                    className="text-left flex justify-between items-center p-4 rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 hover:border-brand-400 transition-colors"
                  >
                    <span className="font-semibold text-ink-800 dark:text-white">{t.business_name}</span>
                    <span className="qnum text-lg text-brand-700 dark:text-brand-300">{t.queue_number}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {activeTicket && (
        <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in" onClick={() => setActiveTicket(null)}>
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-3xl shadow-xl w-full sm:max-w-sm p-6 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-ink-800 dark:text-white">{activeTicket.business_name}</h3>
              <button onClick={() => setActiveTicket(null)} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-300 text-2xl leading-none">&times;</button>
            </div>
            <p className="qnum text-5xl text-ink-900 dark:text-white mb-2">{activeTicket.queue_number}</p>
            <p className="text-ink-500 dark:text-ink-400 text-sm">
              {activeTicket.start_time && activeTicket.start_time !== '-'
                ? `${toDateKey(activeTicket.date)?.replace(/-/g, '/') || ''} · ${activeTicket.start_time?.slice(0, 5)} - ${activeTicket.end_time?.slice(0, 5)}`
                : 'Walk-in queue (no fixed time)'}
            </p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-300">
              {activeTicket.status_name}
            </span>
            {activeTicket.status_name === 'Waiting' && (
              <button
                onClick={() => handleCancel(activeTicket.ticket_id)}
                className="mt-4 w-full px-4 py-3 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl text-sm font-bold"
              >
                Cancel ticket
              </button>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        open={cancelId !== null}
        title="Cancel this ticket?"
        message="Your slot will be released right away."
        confirmLabel="Yes, cancel ticket"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}