import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';

const HOUR_HEIGHT = 64;
const DAYS_AHEAD = 14;

const STATUS_COLORS = {
  Waiting:   { bg: 'bg-amber-500',   border: 'border-amber-600',   text: 'text-white' },
  Serving:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
  Completed: { bg: 'bg-slate-400',   border: 'border-slate-500',   text: 'text-white' },
  Cancelled: { bg: 'bg-rose-300',    border: 'border-rose-400',    text: 'text-rose-900' }
};

const toDateKey = (d) => {
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
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [activeTicket, setActiveTicket] = useState(null);

  const customer = getCustomer();
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!customer?.id) { setErrorMsg('Please log in again.'); setLoading(false); return; }
    try {
      const data = await api.get(`/customer/tickets/${customer.id}`);
      if (data.success) { setTickets(data.data); setErrorMsg(''); }
      else { setErrorMsg(data.message || 'Could not load your schedule.'); }
    } catch (error) {
      console.error('Fetch schedule error:', error);
      setErrorMsg('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const handleCancel = async (ticketId) => {
    if (!customer?.id) return toast.error('Please log in again.');
    if (!window.confirm('Cancel this ticket? Your slot will be released right away.')) return;
    try {
      const result = await api.patch(`/customer/tickets/${ticketId}/cancel`, { customer_id: customer.id });
      if (result.success) { toast.success('Ticket cancelled'); setActiveTicket(null); fetchTickets(); }
      else { toast.error(result.message); }
    } catch (error) {
      console.error('Cancel ticket error:', error);
      toast.error('Could not reach the server.');
    }
  };

  const timedTickets = tickets.filter((t) => t.start_time !== '-');
  const walkinTickets = tickets.filter((t) => t.start_time === '-');

  const today = toDateKey(new Date());

  const datesWithBookings = useMemo(() => {
    const set = new Set();
    timedTickets.forEach((t) => set.add(toDateKey(t.date)));
    return set;
  }, [timedTickets]);

  const dateKeys = useMemo(() => {
    const set = new Set();
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(todayDate); d.setDate(todayDate.getDate() + i);
      set.add(toDateKey(d));
    }
    timedTickets.forEach((t) => set.add(toDateKey(t.date)));
    return [...set].sort();
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

  const todaysActiveCount = (ticketsByDate[today] || [])
    .filter((t) => ['Waiting', 'Serving'].includes(t.status_name)).length;

  const dayTickets = ticketsByDate[selectedDate] || [];

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <Navbar userName={customer?.fname} />
        <div className="max-w-4xl mx-auto p-5 text-center text-slate-400 dark:text-slate-500">Loading your schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar userName={customer?.fname} />

      <div className="max-w-4xl mx-auto p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My schedule</h2>
          <div className="flex gap-3 text-sm">
            <Link to="/tickets" className="text-teal-700 dark:text-teal-400 hover:underline">List view</Link>
            <Link to="/businesses" className="text-teal-700 dark:text-teal-400 hover:underline">Book more</Link>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-lg border border-rose-200 dark:border-rose-800 mb-4">
            {errorMsg}
          </div>
        )}

        <div className={`mb-5 p-4 rounded-lg border flex items-center gap-3 ${
          todaysActiveCount > 0
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
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
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-semibold transition-colors"
            aria-label="Previous day"
          >
            &lt;
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-teal-500"
          />

          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-semibold transition-colors"
            aria-label="Next day"
          >
            &gt;
          </button>

          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-sm font-semibold transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {datesWithBookings.has(selectedDate) && (
          <p className="text-xs text-teal-600 dark:text-teal-400 mb-4">● You have bookings on this day</p>
        )}

        {/* Time grid */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white">
              {formatDayChip(selectedDate).weekday}
            </h3>
          </div>

          {events.length === 0 ? (
            <p className="text-center text-slate-400 dark:text-slate-500 py-10">No timed bookings on this day.</p>
          ) : (
            <div className="relative flex" style={{ height: (gridEndHour - gridStartHour) * HOUR_HEIGHT }}>
              <div className="w-16 shrink-0 relative">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 text-right pr-2 text-xs text-slate-400 dark:text-slate-500"
                    style={{ top: (h - gridStartHour) * HOUR_HEIGHT - 7 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              <div className="relative flex-1 border-l border-slate-100 dark:border-slate-700">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700"
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
                      className={`absolute rounded-md px-2 py-1 text-left text-xs shadow-sm border overflow-hidden hover:opacity-90 transition-opacity ${colors.bg} ${colors.border} ${colors.text}`}
                      style={{ top, height, left: `${ev.lane * widthPct}%`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <div className="font-bold truncate">{ev.business_name}</div>
                      <div className="truncate opacity-90">{ev.start_time?.slice(0, 5)}-{ev.end_time?.slice(0, 5)}</div>
                      <div className="truncate opacity-90">#{ev.queue_number}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {walkinTickets.filter((t) => ['Waiting', 'Serving'].includes(t.status_name)).length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Walk-in queues (no fixed time)</h4>
            <div className="flex flex-col gap-2">
              {walkinTickets
                .filter((t) => ['Waiting', 'Serving'].includes(t.status_name))
                .map((t) => (
                  <button
                    key={t.ticket_id}
                    onClick={() => setActiveTicket(t)}
                    className="text-left flex justify-between items-center p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-400 transition-colors"
                  >
                    <span className="font-semibold text-slate-800 dark:text-white">{t.business_name}</span>
                    <span className="text-teal-700 dark:text-teal-400 font-bold">#{t.queue_number}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {activeTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setActiveTicket(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{activeTicket.business_name}</h3>
              <button onClick={() => setActiveTicket(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{activeTicket.queue_number}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {activeTicket.start_time && activeTicket.start_time !== '-'
                ? `${toDateKey(activeTicket.date)?.replace(/-/g, '/') || ''} · ${activeTicket.start_time?.slice(0, 5)} - ${activeTicket.end_time?.slice(0, 5)}`
                : 'Walk-in queue (no fixed time)'}
            </p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {activeTicket.status_name}
            </span>
            {activeTicket.status_name === 'Waiting' && (
              <button
                onClick={() => handleCancel(activeTicket.ticket_id)}
                className="mt-4 w-full px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-md text-sm font-bold transition-colors"
              >
                Cancel ticket
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}