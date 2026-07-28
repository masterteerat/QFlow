import { useState } from 'react';

// สร้าง id ชั่วคราวฝั่ง frontend ไว้ใช้เป็น key ตอน map (ไม่เกี่ยวกับ DB)
let tempIdCounter = 0;
const nextTempId = () => `slot-${++tempIdCounter}-${Date.now()}`;

const emptySlot = () => ({
  tempId: nextTempId(),
  date: '',
  start_time: '',
  end_time: ''
});

export default function RegisterBusinessModal({ ownerId, onClose, onSuccess }) {
  const [businessName, setBusinessName] = useState('');
  const [isDeposit, setIsDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [queueType, setQueueType] = useState('walkin'); // 'walkin' | 'timeslot'
  const [timeSlots, setTimeSlots] = useState([emptySlot()]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSlotChange = (tempId, field, value) => {
    setTimeSlots((prev) =>
      prev.map((slot) => (slot.tempId === tempId ? { ...slot, [field]: value } : slot))
    );
  };

  const handleAddSlot = () => setTimeSlots((prev) => [...prev, emptySlot()]);

  const handleRemoveSlot = (tempId) => {
    setTimeSlots((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.tempId !== tempId)));
  };

  const validate = () => {
    if (!businessName.trim()) return 'กรุณากรอกชื่อร้านค้า';
    if (isDeposit && (!depositAmount || Number(depositAmount) <= 0)) {
      return 'กรุณาระบุยอดมัดจำให้ถูกต้อง (มากกว่า 0)';
    }
    if (queueType === 'timeslot') {
      for (const slot of timeSlots) {
        if (!slot.date || !slot.start_time || !slot.end_time) {
          return 'กรุณากรอกข้อมูลรอบเวลาให้ครบทุกช่อง';
        }
        if (slot.start_time >= slot.end_time) {
          return 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุดในทุกรอบ';
        }
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3000/api/owner/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          business_name: businessName.trim(),
          is_deposit: isDeposit,
          deposit_amount: isDeposit ? Number(depositAmount) : 0,
          queue_type: queueType,
          time_slots: queueType === 'timeslot'
            ? timeSlots.map(({ date, start_time, end_time }) => ({ date, start_time, end_time }))
            : []
        })
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(result.data);
      } else {
        setErrorMessage(result.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    } catch (error) {
      console.error('Create business error:', error);
      setErrorMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800">ลงทะเบียนร้านค้าใหม่</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {errorMessage && (
            <div className="bg-red-100 text-red-700 p-3 rounded text-sm">{errorMessage}</div>
          )}

          {/* ชื่อร้านค้า */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">ชื่อร้านค้า</label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-indigo-500"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="เช่น Hakum Village Cafe"
            />
          </div>

          {/* มัดจำ */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">ต้องการเก็บเงินมัดจำหรือไม่?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeposit(false)}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  !isDeposit ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                ไม่เก็บมัดจำ
              </button>
              <button
                type="button"
                onClick={() => setIsDeposit(true)}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  isDeposit ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                เก็บมัดจำ
              </button>
            </div>

            {isDeposit && (
              <div className="mt-3">
                <label className="block text-gray-700 text-sm font-bold mb-2">ยอดมัดจำ (บาท)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-indigo-500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="เช่น 100"
                />
              </div>
            )}
          </div>

          {/* ประเภทคิว */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">ประเภทการรับคิว</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQueueType('walkin')}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  queueType === 'walkin' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                🚶 Walk-in
              </button>
              <button
                type="button"
                onClick={() => setQueueType('timeslot')}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  queueType === 'timeslot' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                🕒 นัดเวลา (Time slot)
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {queueType === 'walkin'
                ? 'ลูกค้าจะรับคิวได้ทันทีโดยไม่ต้องเลือกเวลา'
                : 'ลูกค้าต้องเลือกรอบเวลาที่เปิดไว้ด้านล่างก่อนจอง'}
            </p>
          </div>

          {/* รอบเวลา (แสดงเฉพาะ timeslot) */}
          {queueType === 'timeslot' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-gray-700 text-sm font-bold">รอบเวลาที่เปิดรับจอง</label>
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold"
                >
                  + เพิ่มรอบเวลา
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {timeSlots.map((slot) => (
                  <div key={slot.tempId} className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                    <div className="flex-1">
                      <label className="block text-gray-500 text-xs mb-1">วันที่</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                        value={slot.date}
                        onChange={(e) => handleSlotChange(slot.tempId, 'date', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-500 text-xs mb-1">เวลาเริ่ม</label>
                      <input
                        type="time"
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                        value={slot.start_time}
                        onChange={(e) => handleSlotChange(slot.tempId, 'start_time', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-500 text-xs mb-1">เวลาสิ้นสุด</label>
                      <input
                        type="time"
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                        value={slot.end_time}
                        onChange={(e) => handleSlotChange(slot.tempId, 'end_time', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.tempId)}
                      disabled={timeSlots.length === 1}
                      className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed text-sm font-semibold px-2 py-2"
                      title={timeSlots.length === 1 ? 'ต้องมีอย่างน้อย 1 รอบ' : 'ลบรอบนี้'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ปุ่มยืนยัน */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันลงทะเบียนร้าน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}