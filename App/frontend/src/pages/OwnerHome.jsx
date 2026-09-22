import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RegisterBusinessModal from './RegisterBusinessModal';
import QRScannerModal from '../components/QRScannerModal';
import { api } from '../lib/api';
import { getOwner } from '../lib/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '../context/ToastContext';

function ShopThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full aspect-[16/10] shrink-0 bg-gradient-to-br from-teal-100 dark:from-teal-900/30 to-teal-50 dark:to-teal-900/20 flex items-center justify-center">
        <svg className="w-12 h-12 text-teal-400 dark:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full aspect-[16/10] shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="block w-full h-full object-contain"
      />
    </div>
  );
}

function ShopAvatar({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-teal-100 dark:from-teal-900/30 to-teal-50 dark:to-teal-900/20 flex items-center justify-center">
        <svg className="w-7 h-7 text-teal-400 dark:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <img src={src} alt={alt} onError={() => setFailed(true)} className="block w-full h-full object-contain" />
    </div>
  );
}

export default function OwnerHome() {
  const { businessId } = useParams();
  const navigate = useNavigate();

  const [myShops, setMyShops] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showEditShopModal, setShowEditShopModal] = useState(false);

  const [analytics, setAnalytics] = useState({
    totals: { total_queues: 0, queues_today: 0, queues_past_month: 0, total_cancelled: 0 },
    chartData: []
  });

  const owner = getOwner();
  const { toast } = useToast();

  const selectedShop = businessId
    ? myShops.find((s) => String(s.business_id) === businessId)
    : null;

  const fetchMyShops = useCallback(async () => {
    if (!owner?.id) { setLoadingShops(false); return; }
    try {
      const data = await api.get('/owner/businesses', { ownerId: owner.id });
      if (data.success) setMyShops(data.data);
    } catch (error) {
      console.error('Fetch shops error:', error);
    } finally {
      setLoadingShops(false);
    }
  }, [owner?.id]);

  const fetchQueue = useCallback(async (id) => {
    try {
      const data = await api.get(`/owner/queue/${id}`);
      if (data.success) setQueueList(data.data);
    } catch (error) {
      console.error('Fetch queue error:', error);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (id) => {
    try {
      const res = await api.get(`/owner/analytics/${id}`);
      if (res.success) setAnalytics(res.data);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, []);

  useEffect(() => { fetchMyShops(); }, [fetchMyShops]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!businessId) return;
    setShowEditShopModal(false);
    setLoadingQueue(true);
    fetchQueue(businessId);
    fetchAnalytics(businessId);
    const interval = setInterval(() => fetchQueue(businessId), 10000);
    return () => clearInterval(interval);
  }, [businessId, fetchQueue, fetchAnalytics]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAction = async (ticketId, action) => {
    setActionLoadingId(ticketId);
    try {
      const result = await api.patch(`/owner/tickets/${ticketId}/${action}`, { business_id: businessId });
      if (result.success) {
        toast.success('Action completed');
        fetchQueue(businessId);
        fetchMyShops();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      toast.error('Could not reach the server.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleScanSuccess = async (qrDataString) => {
    setShowScanner(false);
    try {
      const payload = JSON.parse(qrDataString);

      setActionLoadingId(payload.ticketId);
      const result = await api.patch(`/owner/tickets/${payload.ticketId}/checkin`, { ...payload, business_id: businessId });

      if (result.success) {
        toast.success(`Check-in for Ticket #${payload.ticketId} Successful!`);
        fetchQueue(businessId);
        fetchMyShops();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Invalid QR Code format or payload is corrupted.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingList = queueList.filter((t) => t.status_id === 1);
  const servingList = queueList.filter((t) => t.status_id === 2);

  if (loadingShops) {
    return <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading your shops...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar userName={owner?.fname} />

      <div className="max-w-6xl mx-auto p-8">
        {/* ---------------- SHOP LIST (nicer UI) ---------------- */}
        {!selectedShop && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My shops</h2>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Register shop
              </button>
            </div>

            {myShops.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <svg className="mx-auto w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-slate-500 dark:text-slate-400 text-lg font-semibold">No shops yet</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Register your first shop to get started</p>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-4 px-6 py-2.5 bg-teal-700 text-white rounded-lg font-semibold hover:bg-teal-800 transition-colors"
                >
                  Register a shop
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myShops.map((shop) => (
                  <div
                    key={shop.business_id}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                  >
                    <ShopThumbnail src={shop.image} alt={shop.business_name} />

                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{shop.business_name}</h3>
                        {shop.category_name && (
                          <span className="shrink-0 inline-block px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded">
                            {shop.category_name}
                          </span>
                        )}
                      </div>

                      {shop.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{shop.description}</p>
                      )}

                      <div className="flex gap-4 mb-5 text-sm mt-auto">
                        <span className="text-amber-600 dark:text-amber-400">
                          Waiting: <span className="font-bold text-base">{shop.waiting_count}</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Checked in: <span className="font-bold text-base">{shop.serving_count}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => navigate(`/owner/businesses/${shop.business_id}`)}
                        className="w-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 font-bold py-2 px-4 rounded-lg transition-colors border border-teal-200 dark:border-teal-800"
                      >
                        Manage queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- DASHBOARD (graph & schedule edit unchanged) ---------------- */}
        {selectedShop && (
          <div>
            <button onClick={() => navigate('/owner/dashboard')} className="text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 font-medium mb-6 inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to shops
            </button>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                  <ShopAvatar src={selectedShop.image} alt={selectedShop.business_name} />
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{selectedShop.business_name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {selectedShop.is_deposit ? `Deposit: ฿${selectedShop.deposit_amount}` : 'No deposit required'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditShopModal(true)}
                  className="text-sm font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-lg shrink-0"
                >
                  Edit shop
                </button>
              </div>
            </div>

            {showEditShopModal && (
              <div className="mb-8">
                <RegisterBusinessModal
                  ownerId={owner?.id}
                  editData={selectedShop}
                  onClose={() => setShowEditShopModal(false)}
                  onSuccess={() => {
                    setShowEditShopModal(false);
                    fetchMyShops();
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Queues Today</p>
                <p className="text-3xl font-bold text-teal-700 dark:text-teal-400 mt-1">{analytics.totals.queues_today}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Past Few Weeks (30d)</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{analytics.totals.queues_past_month}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Queues</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{analytics.totals.total_queues}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Cancelled</p>
                <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">{analytics.totals.total_cancelled}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">14-Day Queue Activity</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-700" vertical={false} />
                    <XAxis dataKey="date_label" tick={{ fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400 text-xs" axisLine={false} tickLine={false} dy={10} />
                    <YAxis allowDecimals={false} tick={{ fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400 text-xs" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', background: '#0f172a', color: '#f1f5f9' }}
                      labelStyle={{ color: '#f1f5f9' }}
                      itemStyle={{ color: '#5eead4' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line type="monotone" dataKey="count" name="Total Queues" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, fill: '#14b8a6', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#0f766e', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {loadingQueue && <p className="text-slate-500 dark:text-slate-400 mb-4">Loading queue...</p>}

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Waiting ({waitingList.length})</h3>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                Scan QR to Check-in
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
              {waitingList.length === 0 ? (
                <p className="p-4 text-slate-400 dark:text-slate-500 text-sm">No one is waiting.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                      <th className="p-4 font-semibold">Ticket</th>
                      <th className="p-4 font-semibold">Customer</th>
                      <th className="p-4 font-semibold">Slot</th>
                      <th className="p-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-4 font-bold text-teal-700 dark:text-teal-400">{t.queue_number}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-white">{t.fname} {t.lname}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${t.is_walkin ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'}`}>
                            {t.is_walkin ? 'Walk-in' : `${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)}`}
                          </span>
                        </td>
                        <td className="p-4 text-right flex gap-2 justify-end">
                          <button onClick={() => handleAction(t.ticket_id, 'no-show')} disabled={actionLoadingId === t.ticket_id} className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-1 rounded font-medium text-sm transition-colors">No-show</button>
                          <button onClick={() => handleAction(t.ticket_id, 'manual-checkin')} disabled={actionLoadingId === t.ticket_id} className="bg-teal-700 text-white hover:bg-teal-800 px-3 py-1 rounded font-medium text-sm transition-colors">{actionLoadingId === t.ticket_id ? '...' : 'Manual Check-in'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Checked in ({servingList.length})</h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {servingList.length === 0 ? (
                <p className="p-4 text-slate-400 dark:text-slate-500 text-sm">No one has checked in yet.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                      <th className="p-4 font-semibold">Ticket</th>
                      <th className="p-4 font-semibold">Customer</th>
                      <th className="p-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-4 font-bold text-teal-700 dark:text-teal-400">{t.queue_number}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-white">{t.fname} {t.lname}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleAction(t.ticket_id, 'complete')} disabled={actionLoadingId === t.ticket_id} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 py-1 rounded font-medium text-sm transition-colors">{actionLoadingId === t.ticket_id ? '...' : 'Complete'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {showRegisterModal && (
        <RegisterBusinessModal
          ownerId={owner?.id}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            setShowRegisterModal(false);
            fetchMyShops();
          }}
        />
      )}

      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}