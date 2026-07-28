import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import RegisterBusinessModal from './RegisterBusinessModal';

const STATUS_STYLE = {
  1: { bg: '#fff3cd', color: '#856404', label: 'รอสแกน QR' },
  2: { bg: '#d1e7dd', color: '#0f5132', label: 'มาถึงร้านแล้ว' },
};

export default function OwnerHome() {
  const [myShops, setMyShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [queueList, setQueueList] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const getOwnerId = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('owner_user'));
      return storedUser?.id || null;
    } catch {
      return null;
    }
  };

  const fetchMyShops = useCallback(async () => {
    const ownerId = getOwnerId();
    if (!ownerId) {
      setLoadingShops(false);
      return;
    }
    try {
      const res = await fetch(`http://localhost:3000/api/owner/businesses/${ownerId}`);
      const data = await res.json();
      if (data.success) setMyShops(data.data);
    } catch (error) {
      console.error('Fetch shops error:', error);
    } finally {
      setLoadingShops(false);
    }
  }, []);

  const fetchQueue = useCallback(async (businessId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/owner/queue/${businessId}`);
      const data = await res.json();
      if (data.success) {
        setQueueList(data.data);
      } else {
        console.error('Fetch queue failed:', data.message); 
      }
    } catch (error) {
      console.error('Fetch queue error:', error);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    fetchMyShops();
  }, [fetchMyShops]);

  // Poll คิวของร้านที่เลือกทุก 10 วิ เพื่อให้เห็นคนจองใหม่แบบเกือบเรียลไทม์
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
      const res = await fetch(`http://localhost:3000/api/owner/tickets/${ticketId}/${action}`, {
        method: 'PATCH'
      });
      const result = await res.json();
      if (result.success) {
        fetchQueue(selectedShop.business_id);
        fetchMyShops(); // อัปเดตจำนวนคนรอคิวในหน้าเลือกร้านด้วย
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingList = queueList.filter((t) => t.status_id === 1);
  const servingList = queueList.filter((t) => t.status_id === 2);

  if (loadingShops) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลดข้อมูลร้านค้า...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName="Shop Owner" />

      <div className="max-w-6xl mx-auto p-8">
        {/* --- VIEW 1: SHOP SELECTION GRID --- */}
        {!selectedShop && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Businesses</h2>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                + Register New Shop
              </button>
            </div>

            {myShops.length === 0 ? (
              <p className="text-gray-500">ยังไม่มีร้านค้าที่ลงทะเบียนไว้</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myShops.map((shop) => (
                  <div key={shop.business_id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">{shop.business_name}</h3>
                    <div className="space-y-2 mb-6">
                      <p className="text-gray-600 text-sm">
                        กำลังรอสแกน QR: <span className="font-semibold text-yellow-600 text-lg">{shop.waiting_count}</span>
                      </p>
                      <p className="text-gray-600 text-sm">
                        มาถึงร้านแล้ว: <span className="font-semibold text-green-600 text-lg">{shop.serving_count}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedShop(shop)}
                      className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold py-2 px-4 rounded-lg transition-colors border border-indigo-200"
                    >
                      Manage Dashboard
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW 2: INDIVIDUAL SHOP DASHBOARD --- */}
        {selectedShop && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setSelectedShop(null)}
                className="text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1"
              >
                ← Back to Shops
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-1">{selectedShop.business_name}</h2>
              <p className="text-gray-500 text-sm">
                {selectedShop.is_deposit ? `เก็บมัดจำ ${selectedShop.deposit_amount} บาท` : 'ไม่เก็บมัดจำ'}
              </p>
            </div>

            {loadingQueue && <p className="text-gray-500 mb-4">กำลังโหลดคิว...</p>}

            {/* ---- รอสแกน QR (Waiting) ---- */}
            <h3 className="text-xl font-bold text-gray-800 mb-4">รอสแกน QR ({waitingList.length} คน)</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              {waitingList.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm">ยังไม่มีคนรอสแกน QR</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                      <th className="p-4 font-semibold">คิว</th>
                      <th className="p-4 font-semibold">ชื่อลูกค้า</th>
                      <th className="p-4 font-semibold">ประเภท</th>
                      <th className="p-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4 font-bold text-indigo-600">{t.queue_number}</td>
                        <td className="p-4 font-medium text-gray-800">{t.fname} {t.lname}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${t.is_walkin ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'}`}>
                            {t.is_walkin ? 'Walk-in' : `${t.start_time.slice(0,5)}-${t.end_time.slice(0,5)}`}
                          </span>
                        </td>
                        <td className="p-4 text-right flex gap-2 justify-end">
                          <button
                            onClick={() => handleAction(t.ticket_id, 'no-show')}
                            disabled={actionLoadingId === t.ticket_id}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded font-medium text-sm transition-colors"
                          >
                            No-show
                          </button>
                          <button
                            onClick={() => handleAction(t.ticket_id, 'checkin')}
                            disabled={actionLoadingId === t.ticket_id}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 rounded font-medium text-sm transition-colors"
                          >
                            {actionLoadingId === t.ticket_id ? '...' : '📷 Scan QR (มาถึงแล้ว)'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ---- ลูกค้าที่มาถึงร้านแล้ว (Arrived) ---- */}
            <h3 className="text-xl font-bold text-gray-800 mb-4">มาถึงร้านแล้ว ({servingList.length} คน)</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {servingList.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm">ยังไม่มีลูกค้ามาถึงร้าน</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                      <th className="p-4 font-semibold">คิว</th>
                      <th className="p-4 font-semibold">ชื่อลูกค้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servingList.map((t) => (
                      <tr key={t.ticket_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4 font-bold text-indigo-600">{t.queue_number}</td>
                        <td className="p-4 font-medium text-gray-800">{t.fname} {t.lname}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal ลงทะเบียนร้านค้าใหม่ */}
      {showRegisterModal && (
        <RegisterBusinessModal
          ownerId={getOwnerId()}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            setShowRegisterModal(false);
            fetchMyShops(); // โหลดรายการร้านใหม่ทันทีหลังลงทะเบียนสำเร็จ
          }}
        />
      )}
    </div>
  );
}