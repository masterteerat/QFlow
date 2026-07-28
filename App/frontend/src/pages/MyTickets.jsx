import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// สถานะที่ถือว่า "กำลังดำเนินอยู่" (Waiting, Serving)
const ACTIVE_STATUSES = ['Waiting', 'Serving'];

const STATUS_STYLE = {
  Waiting:   { bg: '#fff3cd', color: '#856404', label: 'กำลังรอคิว' },
  Serving:   { bg: '#cfe2ff', color: '#084298', label: 'กำลังให้บริการ' },
  Completed: { bg: '#d1e7dd', color: '#0f5132', label: 'เสร็จสิ้น' },
  Cancelled: { bg: '#f8d7da', color: '#842029', label: 'ยกเลิกแล้ว' },
};

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | 'all'

  // ดึง customer id จาก localStorage (เซฟไว้ตอน login)
  const getCustomerId = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      return storedUser?.id || null;
    } catch {
      return null;
    }
  };

  const fetchTickets = useCallback(async () => {
    const customerId = getCustomerId();
    if (!customerId) {
      setErrorMsg('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/customer/tickets/${customerId}`);
      const data = await response.json();
      if (data.success) {
        setTickets(data.data);
        setErrorMsg('');
      } else {
        setErrorMsg(data.message || 'ไม่สามารถโหลดข้อมูลคิวได้');
      }
    } catch (error) {
      console.error('Fetch tickets error:', error);
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    // รีเฟรชอัตโนมัติทุก 15 วิ เพื่อให้เห็นสถานะคิวอัปเดตแบบใกล้เคียง real-time
    const interval = setInterval(fetchTickets, 15000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const displayedTickets = tickets.filter((t) =>
    filter === 'active' ? ACTIVE_STATUSES.includes(t.status_name) : true
  );

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>ติดตามคิวของฉัน</h2>
        <Link to="/customer-home" style={{ color: '#007bff', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← กลับหน้าหลัก
        </Link>
      </div>

      {/* Tabs กรองสถานะ */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setFilter('active')}
          style={{
            padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            backgroundColor: filter === 'active' ? '#007bff' : '#e9ecef',
            color: filter === 'active' ? '#fff' : '#333', fontWeight: 'bold', fontSize: '0.9rem'
          }}
        >
          กำลังดำเนินอยู่
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            backgroundColor: filter === 'all' ? '#007bff' : '#e9ecef',
            color: filter === 'all' ? '#fff' : '#333', fontWeight: 'bold', fontSize: '0.9rem'
          }}
        >
          ทั้งหมด
        </button>
        <button
          onClick={fetchTickets}
          style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: '20px',
            border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.9rem'
          }}
        >
          🔄 รีเฟรช
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#888' }}>กำลังโหลดข้อมูลคิว...</p>}

      {!loading && errorMsg && (
        <div style={{ backgroundColor: '#f8d7da', color: '#842029', padding: '12px', borderRadius: '8px' }}>
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && displayedTickets.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
          {filter === 'active' ? 'ไม่มีคิวที่กำลังดำเนินอยู่ในขณะนี้' : 'ยังไม่มีประวัติการจองคิว'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {displayedTickets.map((ticket) => {
          const style = STATUS_STYLE[ticket.status_name] || { bg: '#e9ecef', color: '#333', label: ticket.status_name };
          return (
            <div
              key={ticket.ticket_id}
              style={{
                border: '1px solid #ddd', borderRadius: '10px', padding: '18px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px 0' }}>{ticket.business_name}</h3>
                <p style={{ margin: '2px 0', color: '#555', fontSize: '0.9rem' }}>
                  วันที่: {ticket.date}
                </p>
                <p style={{ margin: '2px 0', color: '#555', fontSize: '0.9rem' }}>
                  เวลา: {ticket.start_time === '-' ? 'Walk-in (ไม่มีเวลานัดหมาย)' : `${ticket.start_time.slice(0, 5)} - ${ticket.end_time.slice(0, 5)} น.`}
                </p>
                {Number(ticket.amount_paid) > 0 && (
                  <p style={{ margin: '2px 0', color: '#555', fontSize: '0.9rem' }}>
                    ยอดมัดจำที่ชำระ: {ticket.amount_paid} บาท
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
                  {ticket.queue_number}
                </div>
                <span
                  style={{
                    display: 'inline-block', marginTop: '4px', padding: '4px 12px',
                    borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold',
                    backgroundColor: style.bg, color: style.color
                  }}
                >
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
