import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import BanNotice from '../components/BanNotice';
import { QRCodeSVG } from 'qrcode.react';
import { fmtDate } from '../lib/date';
import { fmtMoney } from '../lib/money';
import { useToast } from '../context/ToastContext';
import { Perf, StatusPill } from '../components/TicketParts';

const ACTIVE_STATUSES = ['Waiting', 'Serving'];

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState('active');

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
        setErrorMsg(data.message || 'Could not load your tickets.');
      }
    } catch (error) {
      console.error('Fetch tickets error:', error);
      setErrorMsg('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

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
      if (result.success) {
        toast.success('Ticket cancelled');
        fetchTickets();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Cancel ticket error:', error);
      toast.error('Could not reach the server.');
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 15000); 
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const visibleTickets = tickets.filter((t) => (filter === 'active' ? ACTIVE_STATUSES.includes(t.status_name) : true));

  return (
    <div className="min-h-screen">
      <Navbar userName={customer?.fname} />
      <BanNotice />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">My tickets</h1>
            <p className="text-ink-500 dark:text-ink-400 mt-1">Updates every 15 seconds.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-full bg-ink-100 dark:bg-ink-800">
              {[['active', 'Active'], ['all', 'All']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold ${filter === key ? 'bg-white dark:bg-ink-700 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-ink-600 dark:text-ink-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={fetchTickets} aria-label="Refresh" className="w-10 h-10 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-200 hover:border-brand-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-3.2-6.9M21 4v5h-5" /></svg>
            </button>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[0, 1].map((i) => <div key={i} className="h-80 rounded-3xl bg-ink-200/70 dark:bg-ink-800 animate-pulse" />)}
          </div>
        )}

        {!loading && errorMsg && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 font-medium">{errorMsg}</div>}

        {!loading && !errorMsg && visibleTickets.length === 0 && (
          <div className="text-center bg-white dark:bg-ink-800 rounded-3xl border border-dashed border-ink-300 dark:border-ink-600 p-12">
            <p className="font-display text-xl font-bold text-ink-900 dark:text-white">{filter === 'active' ? 'No active tickets' : 'Nothing here yet'}</p>
            <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">{filter === 'active' ? 'Book a slot or join a walk-in queue to get one.' : "You haven't booked anything yet."}</p>
            <Link to="/businesses" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">Browse shops</Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 items-start">
          {visibleTickets.map((t) => {
            const waiting = t.status_name === 'Waiting';
            const walkin = t.start_time === '-';
            return (
              <article key={t.ticket_id} className={`bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-3xl shadow-sm p-6 ${waiting ? '' : 'opacity-90'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-ink-900 dark:text-white truncate">{t.business_name}</h3>
                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
                      {walkin
                        ? `Walk-in · joined ${t.created_at ? new Date(t.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}`
                        : `${fmtDate(t.date)} · ${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}`}
                    </p>
                  </div>
                  <StatusPill status={t.status_name} />
                </div>

                <div className="flex items-end justify-between gap-3 mt-4">
                  <div className="qnum text-6xl text-ink-900 dark:text-white leading-none">{t.queue_number}</div>
                  {waiting && walkin && t.people_ahead != null && (
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${Number(t.people_ahead) === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' : 'bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200'}`}>
                      {Number(t.people_ahead) === 0 ? "You're next" : `${t.people_ahead} ahead`}
                    </span>
                  )}
                </div>

                {Number(t.amount_paid) > 0 && (
                  <p className="text-sm font-semibold text-ink-600 dark:text-ink-300 mt-3">
                    Deposit ฿{fmtMoney(t.amount_paid)}{t.payment_status === 'Refunded' ? ' (refunded)' : ''}
                  </p>
                )}

                {waiting && (
                  <>
                    <Perf />
                    <div className="flex items-center gap-5">
                      <div className="bg-white p-2.5 rounded-2xl border border-ink-200 shrink-0">
                        <QRCodeSVG value={t.qr_payload || String(t.ticket_id)} size={116} level="H" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-600 dark:text-ink-300 mb-3">Show this code to the staff to check in.</p>
                        <button
                          onClick={() => handleCancel(t.ticket_id)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/25 hover:bg-rose-100 dark:hover:bg-rose-900/45"
                        >
                          Cancel ticket
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
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