import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';

const HOUR_HEIGHT = 64; // px ต่อ 1 ชั่วโมงบน grid
const DAYS_AHEAD = 14;  // ให้ตรงกับ booking window ของร้าน (ดู CustomerHome.jsx)

const STATUS_COLORS = {
  Waiting:   { bg: 'bg-amber-500',   border: 'border-amber-600',   text: 'text-white' },
  Serving:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
  Completed: { bg: 'bg-slate-400',   border: 'border-slate-500',   text: 'text-white' },
  Cancelled: { bg: 'bg-rose-300',    border: 'border-rose-400',    text: 'text-rose-900' }
};

const toDateKey = (d) => String(d).slice(0, 10);
const parseMinutes = (hhmmss) => {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
};

const formatDayChip = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);
  const top = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
  return { top, bottom: `${date.getDate()}/${date.getMonth() + 1}`, weekday: date.toLocaleDateString('en-US', { weekday: 'long' }) };
};

// จัด "lane" ให้คิวที่เวลาซ้อนทับกัน (เช่นจองสองร้านเวลาใกล้กัน) ให้เรียงข้างกันแทนที่จะทับกัน
function assignLanes(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const laneEnds = [];
  sorted.forEach((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }
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
    if (!customer?.id) {
      setErrorMsg('Please log in again.');
      setLoading(false);
      return;
    }
    try {
      const data = await api.get(`/customer/tickets/${customer.id}`);
      if (data.success) {
        setTickets(data.data);
        setErrorMsg('');
      } else {
        setErrorMsg(data.message || 'Could not load your schedule.');
      }
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
      if (result.success) {
        toast.success('Ticket cancelled');
        setActiveTicket(null);
        fetchTickets();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Cancel ticket error:', error);
      toast.error('Could not reach the server.');
    }
  };

  const timedTickets = tickets.filter((t) => t.start_time !== '-');
  const walkinTickets = tickets.filter((t) => t.start_time === '-');

  const dateKeys = useMemo(() => {
    const set = new Set();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
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

  const todayKey = toDateKey(new Date());
  const todaysActiveCount = (ticketsByDate[todayKey] || [])
    .filter((t) => ['Waiting', 'Serving'].includes(t.status_name)).length;

  const dayTickets = ticketsByDate[selectedDate] || [];

  const events = useMemo(() => {
    const withMinutes = dayTickets.map((t) => ({
      ...t,
      startMin: parseMinutes(t.start_time),
      endMin: parseMinutes(t.end_time)
    }));
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

        {/* Reminder banner */}
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

        {/* Date strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {dateKeys.map((dateKey) => {
            const label = formatDayChip(dateKey);
            const isActive = dateKey === selectedDate;
            const count = (ticketsByDate[dateKey] || [])
              .filter((t) => ['Waiting', 'Serving'].includes(t.status_name)).length;
            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                className={`relative flex flex-col items-center px-3 py-2 rounded-lg text-xs font-semibold border min-w-[56px] shrink-0 transition-colors ${
                  isActive
                    ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-teal-400'
                }`}
              >
                <span>{label.top}</span>
                <span className={isActive ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}>{label.bottom}</span>
                {count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    isActive ? 'bg-white text-teal-700' : 'bg-teal-600 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white">
              {formatDayChip(selectedDate).weekday}, {selectedDate}
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
                      style={{
                        top,
                        height,
                        left: `${ev.lane * widthPct}%`,
                        width: `calc(${widthPct}% - 4px)`
                      }}
                    >
                      <div className="font-bold truncate">{ev.business_name}</div>
                      <div className="truncate opacity-90">{ev.start_time.slice(0, 5)}-{ev.end_time.slice(0, 5)}</div>
                      <div className="truncate opacity-90">#{ev.queue_number}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* คิว walk-in ไม่มีเวลาแน่นอน วางบน grid ไม่ได้ เลยแยกไว้ด้านล่าง */}
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

      {/* Ticket detail modal */}
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
                ? `${new Date(activeTicket.date).toLocaleDateString('en-GB')} · ${activeTicket.start_time.slice(0, 5)} - ${activeTicket.end_time.slice(0, 5)}`
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