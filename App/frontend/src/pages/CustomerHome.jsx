import React, { useEffect, useState } from 'react';

export default function CustomerHome() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState({}); // เก็บ timeslot ที่ลูกค้าเลือกแต่ละร้าน

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await fetch('/api/customer/businesses');
      const data = await response.json();
      if (data.success) {
        setBusinesses(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // เลือกรอบเวลา
  const handleSelectSlot = (businessId, slotId) => {
    setSelectedSlots(prev => ({
      ...prev,
      [businessId]: slotId
    }));
  };

  // กดปุ่มจองคิว
  const handleBooking = (business) => {
    const slotId = selectedSlots[business.business_id];
    if (!slotId) {
      alert('กรุณาเลือกรอบเวลาก่อนกดจองคิวครับ');
      return;
    }

    // TODO: ส่ง Request ไปจองคิว หรือเปิด Modal ชำระเงินมัดจำ (ถ้ามี)
    alert(`กำลังดำเนินการจองคิวร้าน: ${business.business_name} (Slot ID: ${slotId})`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลดข้อมูลร้านค้า...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2>รายการร้านค้าที่เปิดรับคิว</h2>

      {businesses.length === 0 ? (
        <p>ยังไม่มีร้านค้าเปิดให้บริการในขณะนี้</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {businesses.map((b) => (
            <div 
              key={b.business_id} 
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              <h3>{b.business_name}</h3>
              <p>
                <strong>ค่ามัดจำ: </strong> 
                {b.is_deposit ? `${b.deposit_amount} บาท` : 'ไม่มีมัดจำ (จองฟรี)'}
              </p>

              <h4 style={{ marginTop: '15px' }}>รอบเวลาที่เปิดจอง:</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '10px 0' }}>
                {b.time_slots.length > 0 ? (
                  b.time_slots.map((slot) => {
                    const isSelected = selectedSlots[b.business_id] === slot.timeslot_id;
                    return (
                      <button
                        key={slot.timeslot_id}
                        onClick={() => handleSelectSlot(b.business_id, slot.timeslot_id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #007bff' : '1px solid #ccc',
                          backgroundColor: isSelected ? '#e7f1ff' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {slot.date} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                      </button>
                    );
                  })
                ) : (
                  <span style={{ color: '#888' }}>ไม่มีรอบเวลาเปิดจองในขณะนี้</span>
                )}
              </div>

              <button
                onClick={() => handleBooking(b)}
                disabled={b.time_slots.length === 0}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: b.time_slots.length > 0 ? '#28a745' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: b.time_slots.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                ยืนยันการจองคิว
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}