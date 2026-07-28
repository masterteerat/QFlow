import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';

const ACTIVE_STATUSES = ['Waiting', 'Serving'];

const STATUS_STYLE = {
  Waiting: { bg: 'bg-amber-100', color: 'text-amber-800', label: 'Waiting' },
  Serving: { bg: 'bg-emerald-100', color: 'text-emerald-800', label: 'Checked in' },
  Cancelled: { bg: 'bg-rose-100', color: 'text-rose-800', label: 'Cancelled' }
};

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState('active');

  const fetchTickets = useCallback(async () => {
    const customer = getCustomer();
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
  }, []);

  const handleCancel = async (ticketId) => {
    const customer = getCustomer();
    if (!customer?.id) return alert('Please log in again.');
    if (!window.confirm('Cancel this ticket? Your slot will be released right away.')) return;

    try {
      const result = await api.patch(`/customer/tickets/${ticketId}/cancel`, { customer_id: customer.id });
      if (result.success) {
        fetchTickets();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Cancel ticket error:', error);
      alert('Could not reach the server.');
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 15000); // near-live status updates
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const visibleTickets = tickets.filter((t) => (filter === 'active' ? ACTIVE_STATUSES.includes(t.status_name) : true));

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800">My tickets</h2>
        <Link to="/customer-home" className="text-teal-700 text-sm hover:underline">← Back home</Link>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            filter === 'active' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            filter === 'all' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          All
        </button>
        <button onClick={fetchTickets} className="ml-auto px-4 py-2 rounded-full text-sm border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
          Refresh
        </button>
      </div>

      {loading && <p className="text-center text-slate-400">Loading...</p>}

      {!loading && errorMsg && <div className="bg-rose-50 text-rose-700 p-3 rounded-lg">{errorMsg}</div>}

      {!loading && !errorMsg && visibleTickets.length === 0 && (
        <p className="text-center text-slate-400 mt-10">
          {filter === 'active' ? 'No active tickets right now.' : "You haven't booked anything yet."}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {visibleTickets.map((t) => {
          const style = STATUS_STYLE[t.status_name] || { bg: 'bg-slate-100', color: 'text-slate-700', label: t.status_name };
          return (
            <div key={t.ticket_id} className="border border-slate-200 rounded-lg p-5 bg-white shadow-sm flex justify-between items-center gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-slate-800">{t.business_name}</h3>
                <p className="text-slate-500 text-sm mt-1">Date: {t.date}</p>
                <p className="text-slate-500 text-sm">
                  Time: {t.start_time === '-' ? 'Walk-in (no set time)' : `${t.start_time.slice(0, 5)} - ${t.end_time.slice(0, 5)}`}
                </p>
                {Number(t.amount_paid) > 0 && <p className="text-slate-500 text-sm">Deposit paid: ฿{t.amount_paid}</p>}
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold text-slate-800">{t.queue_number}</div>
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-bold ${style.bg} ${style.color}`}>
                  {style.label}
                </span>

                {t.status_name === 'Waiting' && (
                  <div className="mt-3">
                    <button
                      onClick={() => handleCancel(t.ticket_id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
