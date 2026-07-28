import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function CustomerHome() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState({});

  // State สำหรับ Modal จ่ายเงิน และการแสดงหน้าบัตรคิว
  const [paymentModal, setPaymentModal] = useState(null); // เก็บข้อมูลร้านที่รอจ่ายเงิน
  const [ticketData, setTicketData] = useState(null); // เก็บข้อมูลบัตรคิวหลังจองสำเร็จ
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/customer/businesses');
      const data = await response.json();
      if (data.success) setBusinesses(data.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ดึง customer id ของผู้ใช้ที่ล็อกอินอยู่จริง (เซฟไว้ตอน login) แทนการ hardcode
  const getCustomerId = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('customer_user'));
      return storedUser?.id || null;
    } catch {
      return null;
    }
  };

  const handleSelectSlot = (businessId, slot) => {
    if (slot.is_booked) return; // กันเผื่อ ไม่ให้เลือก slot ที่ถูกจองแล้วได้
    setSelectedSlots(prev => ({ ...prev, [businessId]: slot.timeslot_id }));
  };

  // ขั้นตอนที่ 1: ตรวจสอบเมื่อกดปุ่มจองคิว
  const handleInitiateBooking = (business) => {
    const isWalkin = business.time_slots.length === 0;
    const slotId = selectedSlots[business.business_id] || null;

    // ร้านที่มี timeslot ต้องเลือกก่อน ส่วนร้าน walk-in ข้ามการเช็คนี้ไปได้เลย
    if (!isWalkin && !slotId) {
      alert('กรุณาเลือกรอบเวลาก่อนกดจองคิวครับ');
      return;
    }

    // ถ้าร้านมีมัดจำ ให้เปิด Modal จ่ายเงินก่อน
    if (business.is_deposit && Number(business.deposit_amount) > 0) {
      setPaymentModal({
        business,
        slotId, // จะเป็น null สำหรับร้าน walk-in ซึ่งถูกต้องแล้ว
        amount: business.deposit_amount
      });
    } else {
      // ถ้าไม่มีมัดจำ ยิง API จองคิวเลย (ยอดจ่าย = 0)
      executeBooking(business.business_id, slotId, 0);
    }
  };

  // ขั้นตอนที่ 2: ยิง API บันทึกลง Database
  const executeBooking = async (businessId, timeslotId, amountPaid) => {
    const customerId = getCustomerId();
    if (!customerId) {
      alert('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3000/api/customer/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          business_id: businessId,
          timeslot_id: timeslotId,
          amount_paid: amountPaid
        })
      });

      const result = await response.json();
      if (result.success) {
        setPaymentModal(null); // ปิด Modal จ่ายเงิน (ถ้าเปิดอยู่)
        setTicketData(result.data); // นำข้อมูลไปแสดงหน้าบัตรคิว
        setSelectedSlots({});
      } else {
        // เช่นกรณี 409 ช่วงเวลานี้ถูกจองไปแล้ว (มีคนแซงจองก่อน)
        alert('เกิดข้อผิดพลาด: ' + result.message);
        setPaymentModal(null);
        fetchBusinesses(); // รีเฟรชสถานะ slot ล่าสุด เผื่อมีคนจองไปแล้วระหว่างที่พี่กำลังจอง
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('ไม่สามารถเชื่อมต่อระบบจองคิวได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  // กลับหน้าหลัก พร้อมรีเฟรชสถานะ slot ใหม่ (เผื่อ slot ที่เพิ่งจองไปกลายเป็นสีเทาแล้ว)
  const handleBackToHome = () => {
    setTicketData(null);
    setSelectedSlots({});
    fetchBusinesses();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลดข้อมูลร้านค้า...</div>;

  // ==========================================
  // VIEW 1: หน้าแสดงบัตรคิว (แสดงเมื่อจองสำเร็จ)
  // ==========================================
  if (ticketData) {
    return (
      <div style={{ maxWidth: '500px', margin: '40px auto', padding: '30px', border: '2px dashed #28a745', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#28a745', margin: '0 0 10px 0' }}>🎉 จองคิวสำเร็จ!</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>กรุณาแสดงบัตรคิวนี้แก่พนักงานเมื่อถึงร้าน</p>

        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
          <h1 style={{ fontSize: '3.5rem', margin: '10px 0', color: '#333' }}>{ticketData.queue_number}</h1>
          <span style={{ backgroundColor: '#ffc107', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            สถานะ: {ticketData.status_name}
          </span>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.8', margin: '20px 0', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <p><strong>ร้านค้า:</strong> {ticketData.business_name}</p>
          <p><strong>วันที่:</strong> {ticketData.date}</p>
          <p>
            <strong>เวลา:</strong>{' '}
            {ticketData.start_time === '-'
              ? 'Walk-in (ไม่มีเวลานัดหมาย)'
              : `${ticketData.start_time.slice(0, 5)} - ${ticketData.end_time.slice(0, 5)} น.`}
          </p>
          <p><strong>รหัสการจอง (Ticket ID):</strong> #{ticketData.ticket_id}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBackToHome}
            style={{ flex: 1, padding: '12px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
          >
            กลับสู่หน้าหลัก
          </button>
          <Link
            to="/my-tickets"
            style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ติดตามคิวของฉัน
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: หน้าเลือกคิวร้านค้า (หน้าหลัก)
  // ==========================================
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>รายการร้านค้าที่เปิดรับคิว</h2>
        <Link
          to="/my-tickets"
          style={{
            padding: '8px 16px', backgroundColor: '#e7f1ff', color: '#007bff',
            borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
          }}
        >
          📋 ติดตามคิวของฉัน
        </Link>
      </div>

      {businesses.length === 0 ? (
        <p>ยังไม่มีร้านค้าเปิดให้บริการในขณะนี้</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {businesses.map((b) => {
            const isWalkin = b.time_slots.length === 0;
            const allSlotsBooked = !isWalkin && b.time_slots.every((s) => s.is_booked);

            return (
              <div key={b.business_id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h3>{b.business_name}</h3>
                <p>
                  <strong>ค่ามัดจำ: </strong>
                  {b.is_deposit ? `${b.deposit_amount} บาท` : 'ไม่มีมัดจำ (จองฟรี)'}
                </p>

                <h4 style={{ marginTop: '15px' }}>รอบเวลาที่เปิดจอง:</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '10px 0' }}>
                  {!isWalkin ? (
                    b.time_slots.map((slot) => {
                      const isSelected = selectedSlots[b.business_id] === slot.timeslot_id;
                      const isBooked = slot.is_booked;
                      return (
                        <button
                          key={slot.timeslot_id}
                          onClick={() => handleSelectSlot(b.business_id, slot)}
                          disabled={isBooked}
                          title={isBooked ? 'ช่วงเวลานี้ถูกจองไปแล้ว' : ''}
                          style={{
                            padding: '8px 12px', borderRadius: '6px',
                            border: isSelected ? '2px solid #007bff' : '1px solid #ccc',
                            backgroundColor: isBooked ? '#e9ecef' : (isSelected ? '#e7f1ff' : '#fff'),
                            color: isBooked ? '#999' : '#333',
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            textDecoration: isBooked ? 'line-through' : 'none'
                          }}
                        >
                          {slot.date} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                          {isBooked ? ' • เต็มแล้ว' : ''}
                        </button>
                      );
                    })
                  ) : (
                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                      🚶 ร้านนี้เปิดรับคิว Walk-in — ไม่ต้องเลือกเวลา กดจองได้เลย
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleInitiateBooking(b)}
                  disabled={allSlotsBooked}
                  style={{
                    marginTop: '15px', padding: '10px 20px',
                    backgroundColor: allSlotsBooked ? '#ccc' : '#28a745',
                    color: '#fff', border: 'none', borderRadius: '6px',
                    cursor: allSlotsBooked ? 'not-allowed' : 'pointer'
                  }}
                >
                  {allSlotsBooked ? 'เต็มทุกรอบแล้ว' : (isWalkin ? 'รับคิว Walk-in' : 'ยืนยันการจองคิว')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          VIEW 3: Modal ชำระเงินมัดจำ (QR Code จำลอง)
          ========================================== */}
      {paymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3>ชำระเงินมัดจำการจอง</h3>
            <p style={{ color: '#666' }}>ร้าน: {paymentModal.business.business_name}</p>

            <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>ยอดที่ต้องชำระ</p>
              <h2 style={{ margin: '5px 0', color: '#d9534f' }}>{paymentModal.amount} บาท</h2>
            </div>

            {/* ภาพ QR Code จำลอง */}
            <div style={{ margin: '20px auto', width: '180px', height: '180px', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=PAYMENT-TEST-QFLOW-${paymentModal.amount}`}
                alt="PromptPay QR"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#888' }}>*นี่คือ QR Code จำลองสำหรับทดสอบระบบ*</p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setPaymentModal(null)}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '10px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => executeBooking(paymentModal.business.business_id, paymentModal.slotId, paymentModal.amount)}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'ชำระเงินเรียบร้อย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}