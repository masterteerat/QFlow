import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import RegisterBusinessModal from './RegisterBusinessModal';
import { api } from '../lib/api';
import { getOwner } from '../lib/auth';

export default function OwnerHome() {
  const [myShops, setMyShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [queueList, setQueueList] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const owner = getOwner();

  const fetchMyShops = useCallback(async () => {
    if (!owner?.id) {
      setLoadingShops(false);
      return;
    }
    try {
      const data = await api.get(`/owner/businesses/${owner.id}`);
      if (data.success) setMyShops(data.data);
    } catch (error) {
      console.error('Fetch shops error:', error);
    } finally {
      setLoadingShops(false);
    }
  }, [owner?.id]);

  const fetchQueue = useCallback(async (businessId) => {
    try {
      const data = await api.get(`/owner/queue/${businessId}`);
      if (data.success) setQueueList(data.data);
    } catch (error) {
      console.error('Fetch queue error:', error);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    fetchMyShops();
  }, [fetchMyShops]);

  useEffect(() => {
    if (!selectedShop) return;
    setLoadingQueue(true);
    fetchQueue(selectedShop.business_id);
    const interval = setInterval(() => fetchQueue(selectedShop.business_id), 10000);
    return () => clearInterval(interval);
  }, [selectedShop, fetchQueue]);

  const handleAction = async (ticketId, action) => {
    setActionLoadingId(ticketId);
    try {
      const result = await api.patch(`/owner/tickets/${ticketId}/${action}`);
      if (result.success) {
        fetchQueue(selectedShop.business_id);
        fetchMyShops();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      alert('Could not reach the server.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingList = queueList.filter((t) => t.status_id === 1);
  const servingList = queueList.filter((t) => t.status_id === 2);

  if (loadingShops) {
    return <div className="text-center p-8 text-slate-500">Loading your shops...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userName={owner?.fname} />

      <div className="max-w-6xl mx-auto p-8">
        {!selectedShop && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">My shops</h2>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                + Register a shop
              </button>
            </div>

            {myShops.length === 0 ? (
              <p className="text-slate-500">You haven't registered a shop yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myShops.map((shop) => (
                  <div key={shop.business_id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">{shop.business_name}</h3>
                    <div className="space-y-2 mb-6">
                      <p className="text-slate-600 text-sm">
                        Waiting: <span className="font-semibold text-amber-600 text-lg">{shop.waiting_count}</span>
                      </p>
                      <p className="text-slate-600 text-sm">
                        Checked in: <span className="font-semibold text-emerald-600 text-lg">{shop.serving_count}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedShop(shop)}
                      className="w-full bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold py-2 px-4 rounded-lg transition-colors border border-teal-200"
                    >
                      Manage queue
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedShop && (
          <div>
            <button onClick={() => setSelectedShop(null)} className="text-slate-500 hover:text-teal-700 font-medium mb-6">
              ← Back to shops
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-1">{selectedShop.business_name}</h2>
              <p className="text-slate-500 text-sm">
                {selectedShop.is_deposit ? `Deposit: ฿${selectedShop.deposit_amount}` : 'No deposit required'}
              </p>
            </div>

            {loadingQueue && <p className="text-slate-500 mb-4">Loading queue...</p>}

            <h3 className="text-xl font-bold text-slate-800 mb-4">Waiting ({waitingList.length})</h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              {waitingList.length === 0 ? (
                <p className="p-4 text-slate-400 text-sm">No one is waiting.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                      <th className="p-4 font-semibold">Ticket</th>
                      <th className="p-4 font-semibold">Customer</th>
                      <th className="p-4 font-semibold">Slot</th>
                      <th className="p-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-teal-700">{t.queue_number}</td>
                        <td className="p-4 font-medium text-slate-800">{t.fname} {t.lname}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${t.is_walkin ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                            {t.is_walkin ? 'Walk-in' : `${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)}`}
                          </span>
                        </td>
                        <td className="p-4 text-right flex gap-2 justify-end">
                          <button
                            onClick={() => handleAction(t.ticket_id, 'no-show')}
                            disabled={actionLoadingId === t.ticket_id}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1 rounded font-medium text-sm transition-colors"
                          >
                            No-show
                          </button>
                          <button
                            onClick={() => handleAction(t.ticket_id, 'checkin')}
                            disabled={actionLoadingId === t.ticket_id}
                            className="bg-teal-700 text-white hover:bg-teal-800 px-3 py-1 rounded font-medium text-sm transition-colors"
                          >
                            {actionLoadingId === t.ticket_id ? '...' : 'Scan QR (check in)'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-4">Checked in ({servingList.length})</h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {servingList.length === 0 ? (
                <p className="p-4 text-slate-400 text-sm">No one has checked in yet.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                      <th className="p-4 font-semibold">Ticket</th>
                      <th className="p-4 font-semibold">Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-teal-700">{t.queue_number}</td>
                        <td className="p-4 font-medium text-slate-800">{t.fname} {t.lname}</td>
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
    </div>
  );
}
