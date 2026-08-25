import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import { QRCodeSVG } from 'qrcode.react'; // นำเข้าไลบรารี

const ACTIVE_STATUSES = ['Waiting', 'Serving'];

const STATUS_STYLE = {
  Waiting: { bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-800 dark:text-amber-300', label: 'Waiting' },
  Serving: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', color: 'text-emerald-800 dark:text-emerald-300', label: 'Checked in' },
  Cancelled: { bg: 'bg-rose-100 dark:bg-rose-900/40', color: 'text-rose-800 dark:text-rose-300', label: 'Cancelled' }
};

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState('active');

  const customer = getCustomer();

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

  const handleCancel = async (ticketId) => {
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
    const interval = setInterval(fetchTickets, 15000); 
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const visibleTickets = tickets.filter((t) => (filter === 'active' ? ACTIVE_STATUSES.includes(t.status_name) : true));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar userName={customer?.fname} />
      
      <div className="max-w-2xl mx-auto p-5">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My tickets</h2>
          <Link to="/businesses" className="text-teal-700 dark:text-teal-400 text-sm hover:underline">← Back home</Link>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              filter === 'active' ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              filter === 'all' ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            All
          </button>
          <button onClick={fetchTickets} className="ml-auto px-4 py-2 rounded-full text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Refresh
          </button>
        </div>

        {loading && <p className="text-center text-slate-400 dark:text-slate-500">Loading...</p>}

        {!loading && errorMsg && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-lg border border-rose-200 dark:border-rose-800">{errorMsg}</div>}

        {!loading && !errorMsg && visibleTickets.length === 0 && (
          <p className="text-center text-slate-400 dark:text-slate-500 mt-10">
            {filter === 'active' ? 'No active tickets right now.' : "You haven't booked anything yet."}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {visibleTickets.map((t) => {
            const style = STATUS_STYLE[t.status_name] || { bg: 'bg-slate-100 dark:bg-slate-700', color: 'text-slate-700 dark:text-slate-300', label: t.status_name };
            return (
              <div key={t.ticket_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 bg-white dark:bg-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-5 transition-colors duration-300">
                
                {/* ข้อมูลร้าน */}
                <div className="w-full sm:w-auto flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">{t.business_name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Date: {t.date}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Time: {t.start_time === '-' ? 'Walk-in (no set time)' : `${t.start_time.slice(0, 5)} - ${t.end_time.slice(0, 5)}`}
                  </p>
                  {Number(t.amount_paid) > 0 && <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-teal-600 dark:text-teal-400 mt-1">Deposit paid: ฿{t.amount_paid}</p>}
                </div>

                {/* แสดง QR Code สำหรับตั๋วที่ยัง Waiting */}
                {t.status_name === 'Waiting' && (
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0">
                    <QRCodeSVG 
                      value={t.qr_payload || String(t.ticket_id)} 
                      size={110} 
                      level="H" 
                    />
                  </div>
                )}

                {/* หมายเลขคิวและปุ่ม Cancel */}
                <div className="w-full sm:w-auto text-center sm:text-right shrink-0 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-4 sm:pt-0 sm:pl-5">
                  <div className="text-4xl font-bold text-slate-800 dark:text-white">{t.queue_number}</div>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.color}`}>
                    {style.label}
                  </span>

                  {t.status_name === 'Waiting' && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleCancel(t.ticket_id)}
                        className="px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 w-full rounded-md text-sm font-bold transition-colors"
                      >
                        Cancel Ticket
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}