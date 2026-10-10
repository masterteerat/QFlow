import { fmtMoney } from '../lib/money';
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
      <div className="w-full aspect-[16/10] shrink-0 bg-gradient-to-br from-brand-100 dark:from-brand-900/30 to-brand-50 dark:to-brand-900/20 flex items-center justify-center">
        <svg className="w-12 h-12 text-brand-400 dark:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full aspect-[16/10] shrink-0 overflow-hidden bg-ink-100 dark:bg-ink-900 flex items-center justify-center">
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
      <div className="w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-brand-100 dark:from-brand-900/30 to-brand-50 dark:to-brand-900/20 flex items-center justify-center">
        <svg className="w-7 h-7 text-brand-400 dark:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-ink-100 dark:bg-ink-900 flex items-center justify-center">
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // FIX: the delete modal referenced an undefined `shop`; track which shop is being deleted
  const [shopToDelete, setShopToDelete] = useState(null);

  const [cancelHistory, setCancelHistory] = useState([]);
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
      const data = await api.get('/owner/businesses');
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

  const fetchCancelHistory = useCallback(async (id) => {
    try {
      const res = await api.get(`/owner/cancelled/${id}`);
      if (res.success) setCancelHistory(res.data);
    } catch (error) {
      console.error('Cancel history error:', error);
    }
  }, []);

  useEffect(() => { fetchMyShops(); }, [fetchMyShops]);

  useEffect(() => {
    if (!businessId) return;
    setShowEditShopModal(false);
    setLoadingQueue(true);
    fetchQueue(businessId);
    fetchAnalytics(businessId);
    fetchCancelHistory(businessId);
    const interval = setInterval(() => { fetchQueue(businessId); fetchCancelHistory(businessId); }, 10000);
    return () => clearInterval(interval);
  }, [businessId, fetchQueue, fetchAnalytics, fetchCancelHistory]);

  const handleAction = async (ticketId, action) => {
    setActionLoadingId(ticketId);
    try {
      const result = await api.patch(`/owner/tickets/${ticketId}/${action}`, { business_id: businessId });
      if (result.success) {
        toast.success('Action completed');
        fetchQueue(businessId);
        fetchCancelHistory(businessId);
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

  const handleDeleteShop = async () => {
    if (!shopToDelete) return;
    setActionLoadingId(shopToDelete.business_id);
    try {
      const result = await api.delete(`/owner/businesses/${shopToDelete.business_id}`);
      if (result.success) {
        toast.success('Shop deleted successfully');
        setShowDeleteModal(false);
        setShopToDelete(null);
        setShowScanner(false);
        fetchMyShops();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Delete shop error:', error);
      toast.error('Could not reach the server.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bangkok "today" as YYYY-MM-DD; bookings for later days are shown but can't be checked in yet
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const isFuture = (t) => !!t.date && t.date > todayStr;
  const waitingList = queueList.filter((t) => t.status_id === 1);
  const servingList = queueList.filter((t) => t.status_id === 2);

  if (loadingShops) {
    return <div className="text-center p-8 text-ink-500 dark:text-ink-400">Loading your shops...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar userName={owner?.fname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ---------------- SHOP LIST (nicer UI) ---------------- */}
        {!selectedShop && (
          <div>
            <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">My shops</h1>
                <p className="text-ink-500 dark:text-ink-400 mt-1">Pick a shop to run its queue.</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-brand-700 hover:bg-brand-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Register shop
              </button>
            </div>

            {myShops.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-ink-800 rounded-xl border border-ink-200 dark:border-ink-700">
                <svg className="mx-auto w-16 h-16 text-ink-300 dark:text-ink-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-ink-500 dark:text-ink-400 text-lg font-semibold">No shops yet</p>
                <p className="text-ink-400 dark:text-ink-500 text-sm mt-1">Register your first shop to get started</p>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-4 px-6 py-2.5 bg-brand-700 text-white rounded-lg font-semibold hover:bg-brand-800 transition-colors"
                >
                  Register a shop
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myShops.map((shop) => (
                  <div
                    key={shop.business_id}
                    className="bg-white dark:bg-ink-800 rounded-2xl shadow-sm border border-ink-200 dark:border-ink-700 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition flex flex-col"
                  >
                    <ShopThumbnail src={shop.image} alt={shop.business_name} />

                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="text-lg font-bold text-ink-800 dark:text-white leading-tight">{shop.business_name}</h3>
                        {shop.category_name && (
                          <span className="shrink-0 inline-block px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-semibold rounded">
                            {shop.category_name}
                          </span>
                        )}
                      </div>

                      {shop.description && (
                        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4 line-clamp-2">{shop.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-4 mt-auto">
                        <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 px-3 py-2.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:text-brand-300">Waiting</p>
                          <p className="qnum text-2xl text-brand-700 dark:text-brand-300">{shop.waiting_count}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Checked in</p>
                          <p className="qnum text-2xl text-emerald-700 dark:text-emerald-300">{shop.serving_count}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/owner/businesses/${shop.business_id}`)}
                          className="flex-1 py-2.5 font-bold text-white bg-ink-900 dark:bg-brand-600 hover:bg-ink-800 dark:hover:bg-brand-500 rounded-xl"
                        >
                          Manage queue
                        </button>
                        {owner && (
                          <button
                            onClick={() => { setShopToDelete(shop); setShowDeleteModal(true); }}
                            className="px-4 py-2.5 text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/25 hover:bg-rose-100 dark:hover:bg-rose-900/45 rounded-xl"
                            title="Delete this shop"
                            aria-label={`Delete ${shop.business_name}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
            <button onClick={() => navigate('/owner/dashboard')} className="text-ink-500 dark:text-ink-400 hover:text-brand-700 dark:hover:text-brand-300 font-bold text-sm inline-flex items-center gap-1 mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              All shops
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <ShopAvatar src={selectedShop.image} alt={selectedShop.business_name} />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-white leading-tight">{selectedShop.business_name}</h1>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200 text-xs font-bold">
                      {selectedShop.queue_type === 'walkin' ? 'Walk-in queue' : 'Time slots'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200 text-xs font-bold">
                      {selectedShop.is_deposit ? `Deposit ฿${fmtMoney(selectedShop.deposit_amount)}` : 'No deposit'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowEditShopModal(true)}
                className="text-sm font-bold text-ink-700 dark:text-ink-100 border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 hover:border-brand-400 px-4 py-2 rounded-xl shrink-0"
              >
                Edit shop
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr] gap-3 mt-6 mb-8">
              <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-2xl p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Waiting</p>
                <p className="qnum text-4xl sm:text-5xl text-brand-700 dark:text-brand-300 mt-1">{waitingList.length}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-2xl p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Checked in</p>
                <p className="qnum text-4xl sm:text-5xl text-emerald-700 dark:text-emerald-400 mt-1">{servingList.length}</p>
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="col-span-2 lg:col-span-1 rounded-2xl bg-ink-900 dark:bg-brand-600 hover:bg-ink-800 dark:hover:bg-brand-500 text-white p-4 sm:p-5 flex items-center justify-center lg:justify-start gap-4 shadow-md"
              >
                <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M7 12h10" /></svg>
                </span>
                <span className="text-left">
                  <span className="block font-display text-lg font-extrabold leading-tight">Scan QR to check in</span>
                  <span className="block text-sm text-white/70">Point the camera at a customer's ticket</span>
                </span>
              </button>
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

            {loadingQueue && <p className="text-ink-500 dark:text-ink-400 mb-4">Loading queue...</p>}

            <h2 className="font-display text-xl font-extrabold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
              Waiting <span className="qnum text-sm px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-200">{waitingList.length}</span>
            </h2>
            {waitingList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-300 dark:border-ink-600 bg-white/60 dark:bg-ink-800/60 p-6 text-center text-ink-500 dark:text-ink-400 text-sm mb-8">No one is waiting right now.</div>
            ) : (
              <ul className="space-y-2.5 mb-8">
                {waitingList.map((t) => (
                  <li key={t.ticket_id} className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-200 dark:border-ink-700 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-5">
                    <div className="qnum text-2xl sm:text-3xl w-[4.5rem] sm:w-24 shrink-0 text-brand-700 dark:text-brand-300">{t.queue_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink-900 dark:text-white truncate">
                        {t.fname} {t.lname}
                        {t.pax > 1 && <span className="ml-2 text-xs font-bold text-ink-500 dark:text-ink-400">× {t.pax} people</span>}
                      </p>
                      <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${t.is_walkin ? 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200'}`}>
                        {t.is_walkin ? 'Walk-in' : `${isFuture(t) ? t.date.slice(5) + ' · ' : ''}${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}`}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(t.ticket_id, 'manual-checkin')}
                        disabled={actionLoadingId === t.ticket_id || isFuture(t)}
                        title={isFuture(t) ? 'Booked for a later day' : undefined}
                        className="bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 sm:py-2 rounded-xl font-bold text-sm whitespace-nowrap"
                      >
                        {actionLoadingId === t.ticket_id ? '...' : 'Check in'}
                      </button>
                      <button
                        onClick={() => handleAction(t.ticket_id, 'no-show')}
                        disabled={actionLoadingId === t.ticket_id || isFuture(t)}
                        className="bg-rose-50 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/45 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 sm:py-2 rounded-xl font-bold text-sm whitespace-nowrap"
                      >
                        No-show
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="font-display text-xl font-extrabold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
              Checked in <span className="qnum text-sm px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">{servingList.length}</span>
            </h2>
            {servingList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-300 dark:border-ink-600 bg-white/60 dark:bg-ink-800/60 p-6 text-center text-ink-500 dark:text-ink-400 text-sm">No one has checked in yet.</div>
            ) : (
              <ul className="space-y-2.5">
                {servingList.map((t) => (
                  <li key={t.ticket_id} className="bg-white dark:bg-ink-800 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-5">
                    <div className="qnum text-2xl sm:text-3xl w-[4.5rem] sm:w-24 shrink-0 text-emerald-700 dark:text-emerald-400">{t.queue_number}</div>
                    <p className="flex-1 min-w-0 font-bold text-ink-900 dark:text-white truncate">
                      {t.fname} {t.lname}
                      {t.pax > 1 && <span className="ml-2 text-xs font-bold text-ink-500 dark:text-ink-400">× {t.pax} people</span>}
                    </p>
                    <button
                      onClick={() => handleAction(t.ticket_id, 'complete')}
                      disabled={actionLoadingId === t.ticket_id}
                      className="bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-900 hover:bg-ink-700 dark:hover:bg-white px-4 py-2.5 sm:py-2 rounded-xl font-bold text-sm shrink-0"
                    >
                      {actionLoadingId === t.ticket_id ? '...' : 'Complete'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <details className="group mt-8 bg-white dark:bg-ink-800 rounded-2xl border border-ink-200 dark:border-ink-700 overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 font-display text-lg font-extrabold text-ink-900 dark:text-white">
                <span>Cancelled history <span className="qnum text-sm ml-1 px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300">{cancelHistory.length}</span></span>
                <svg className="w-5 h-5 text-ink-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              {cancelHistory.length === 0 ? (
                <p className="px-5 pb-5 text-ink-500 dark:text-ink-400 text-sm">No cancelled tickets yet.</p>
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-700 border-t border-ink-100 dark:border-ink-700">
                  {cancelHistory.map((t) => (
                    <li key={t.ticket_id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="qnum text-lg w-16 text-ink-400">{t.queue_number}</span>
                      <span className="font-bold text-ink-900 dark:text-white flex-1 min-w-[8rem]">
                        {t.fname ? `${t.fname} ${t.lname}` : 'Deleted customer'}
                        {t.pax > 1 && <span className="ml-2 text-xs text-ink-400">× {t.pax}</span>}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${t.cancelled_by === 'no_show' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300'}`}>
                        {t.cancelled_by === 'no_show' ? 'No-show' : t.cancelled_by === 'customer' ? 'Cancelled by customer' : t.cancelled_by === 'expired' ? 'Expired (never arrived)' : 'Cancelled'}
                      </span>
                      <span className="text-xs text-ink-500 dark:text-ink-400 w-full sm:w-auto">
                        {t.date} {t.is_walkin ? '(Walk-in)' : `${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}`} · cancelled {new Date(t.cancelled_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <h2 className="font-display text-xl font-extrabold text-ink-900 dark:text-white mt-12 mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-ink-800 p-5 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700">
                <p className="text-sm font-medium text-ink-500 dark:text-ink-400">Tickets today</p>
                <p className="text-3xl font-bold text-brand-700 dark:text-brand-400 mt-1">{analytics.totals.queues_today}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 p-5 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700">
                <p className="text-sm font-medium text-ink-500 dark:text-ink-400">Last 30 days</p>
                <p className="text-3xl font-bold text-ink-800 dark:text-white mt-1">{analytics.totals.queues_past_month}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 p-5 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700">
                <p className="text-sm font-medium text-ink-500 dark:text-ink-400">Total tickets</p>
                <p className="text-3xl font-bold text-ink-800 dark:text-white mt-1">{analytics.totals.total_queues}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 p-5 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700">
                <p className="text-sm font-medium text-ink-500 dark:text-ink-400">Total cancelled</p>
                <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">{analytics.totals.total_cancelled}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-ink-800 p-6 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700 mb-8">
              <h3 className="text-lg font-bold text-ink-800 dark:text-white mb-4">Tickets per day (last 14 days)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100 dark:text-ink-700" vertical={false} />
                    <XAxis dataKey="date_label" tick={{ fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400 text-xs" axisLine={false} tickLine={false} dy={10} />
                    <YAxis allowDecimals={false} tick={{ fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400 text-xs" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', background: '#0f172a', color: '#f1f5f9' }}
                      labelStyle={{ color: '#f1f5f9' }}
                      itemStyle={{ color: '#ffa874' }}
                      cursor={{ stroke: '#cfc7b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line type="monotone" dataKey="count" name="Tickets" stroke="#f46a1f" strokeWidth={3} dot={{ r: 4, fill: '#f46a1f', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#b93a0a', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-lg w-full max-w-md p-8 text-center">
            <h3 className="text-xl font-bold text-ink-800 dark:text-white mb-4">Delete Shop</h3>
            <p className="text-ink-500 dark:text-ink-400 mb-6">Are you sure you want to delete <strong>{shopToDelete?.business_name}</strong>? This action cannot be undone and will also delete all associated time slots, queues, and tickets.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setShowDeleteModal(false); setShopToDelete(null); }}
                className="flex-1 py-2 rounded-lg font-semibold bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteShop}
                disabled={actionLoadingId === shopToDelete?.business_id}
                className="flex-1 py-2 rounded-lg font-semibold bg-rose-700 dark:bg-rose-600 text-white hover:bg-rose-800 dark:hover:bg-rose-700 transition-colors disabled:opacity-60"
              >
                {actionLoadingId === shopToDelete?.business_id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}