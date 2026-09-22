import { useState, useEffect } from 'react';
import { api } from '../lib/api';

let tempIdCounter = 0;
const nextTempId = () => `slot-${++tempIdCounter}-${Date.now()}`;

const emptySlot = () => ({ tempId: nextTempId(), start_time: '', end_time: '', max_capacity: 1 });

export default function RegisterBusinessModal({ ownerId, onClose, onSuccess, editData = null }) {
  const [businessName, setBusinessName] = useState(editData?.business_name || '');
  const [description, setDescription] = useState(editData?.description || '');
  const [isDeposit, setIsDeposit] = useState(editData?.is_deposit || false);
  const [depositAmount, setDepositAmount] = useState(editData?.deposit_amount ? String(editData.deposit_amount) : '');
  const [queueType, setQueueType] = useState(editData?.queue_type || 'walkin');
  const [timeSlots, setTimeSlots] = useState(editData?.time_slots?.length ? editData.time_slots.map(s => ({ tempId: nextTempId(), start_time: s.start_time, end_time: s.end_time, max_capacity: s.max_capacity })) : [emptySlot()]);
  const [categoryId, setCategoryId] = useState(editData?.category_id || '');
  const [categories, setCategories] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(editData?.image || null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [loadingSchedule, setLoadingSchedule] = useState(!!editData?.business_id);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await api.get('/customer/categories');
        if (data.success) setCategories(data.data);
      } catch (e) {
        console.error('Fetch categories error:', e);
      }
    };
    fetchCats();
  }, []);

  // ตอนแก้ไขร้านที่มีอยู่แล้ว ดึงตารางเวลาปัจจุบันมาแสดง แทนที่จะเริ่มจาก slot ว่าง
  useEffect(() => {
    if (!editData?.business_id) return;
    const fetchSchedule = async () => {
      try {
        const res = await api.get(`/owner/businesses/${editData.business_id}/schedule`);
        if (res.success && res.data.length > 0) {
          setTimeSlots(res.data.map((s) => ({
            tempId: nextTempId(),
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
            max_capacity: s.max_capacity
          })));
        }
      } catch (e) {
        console.error('Fetch schedule error:', e);
      } finally {
        setLoadingSchedule(false);
      }
    };
    fetchSchedule();
  }, [editData?.business_id]);

  const updateSlot = (tempId, field, value) => {
    setTimeSlots((prev) => prev.map((slot) => (slot.tempId === tempId ? { ...slot, [field]: value } : slot)));
  };

  const addSlot = () => setTimeSlots((prev) => [...prev, emptySlot()]);
  const removeSlot = (tempId) => setTimeSlots((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.tempId !== tempId)));

  const validate = () => {
    if (!businessName.trim()) return 'Please enter a shop name.';
    if (isDeposit && (!depositAmount || Number(depositAmount) <= 0)) return 'Please enter a valid deposit amount.';
    if (queueType === 'timeslot') {
      for (const slot of timeSlots) {
        if (!slot.start_time || !slot.end_time) return 'Please fill in every time slot.';
        if (slot.start_time >= slot.end_time) return 'Start time must be before end time.';
        if (!slot.max_capacity || Number(slot.max_capacity) < 1) return 'Each slot needs a max capacity of at least 1.';
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) return setError(validationError);

    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('business_name', businessName.trim());
      formData.append('description', description);
      formData.append('is_deposit', isDeposit);
      formData.append('deposit_amount', isDeposit ? Number(depositAmount) : 0);
      formData.append('category_id', categoryId || '');
      formData.append('queue_type', queueType);

      if (queueType === 'timeslot' && timeSlots.length > 0) {
        const slotData = timeSlots.map(({ start_time, end_time, max_capacity }) => ({ start_time, end_time, max_capacity: Number(max_capacity) }));
        formData.append('time_slots', JSON.stringify(slotData));
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editData) {
        const result = await api.put(`/owner/businesses/${editData.business_id}`, formData);
        if (result.success) {
          onSuccess(result.data);
        } else {
          setError(result.message || 'Something went wrong. Please try again.');
        }
      } else {
        formData.append('owner_id', ownerId);
        const result = await api.post('/owner/businesses', formData);
        if (result.success) {
          onSuccess(result.data);
        } else {
          setError(result.message || 'Something went wrong. Please try again.');
        }
      }
    } catch (err) {
      console.error('Create business error:', err);
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors duration-300">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-xl transition-colors duration-300">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editData ? 'Edit shop' : 'Register a new shop'}</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none" aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6" encType="multipart/form-data">
          {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Shop name</label>
            <input
              type="text"
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Hakum Village Cafe"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Description</label>
            <textarea
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your shop..."
              rows="3"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Category</label>
            <select
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">-- Select a category --</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Shop Image</label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-600"
                />
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm text-slate-600 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-slate-700 dark:file:text-teal-400 dark:file:hover:bg-slate-600"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {editData?.image && !imagePreview ? (
                    <img src={editData.image} alt="Current" className="w-16 h-16 object-cover rounded-lg mt-2 border border-slate-300" />
                  ) : null}
                  JPG, PNG, WEBP up to 5MB
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Take a deposit?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeposit(false)}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  !isDeposit ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
              >
                No deposit
              </button>
              <button
                type="button"
                onClick={() => setIsDeposit(true)}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  isDeposit ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
              >
                Take deposit
              </button>
            </div>

            {isDeposit && (
              <div className="mt-3">
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Deposit amount (฿)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">How do customers queue?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQueueType('walkin')}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  queueType === 'walkin' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setQueueType('timeslot')}
                className={`flex-1 py-2 rounded-lg font-semibold border transition-colors ${
                  queueType === 'timeslot' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
              >
                Time slots
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {queueType === 'walkin' ? 'Customers get a ticket instantly, no time to pick.' : 'Customers must pick one of the slots below to book.'}
            </p>
          </div>

          {queueType === 'timeslot' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold">Time slots</label>
                <button type="button" onClick={addSlot} className="text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 text-sm font-semibold">
                  + Add slot
                </button>
              </div>

              {loadingSchedule ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Loading current time slots...</p>
              ) : (
              <div className="flex flex-col gap-3">
                {timeSlots.map((slot) => (
                  <div key={slot.tempId} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">Start time</label>
                      <input type="time" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded text-sm" value={slot.start_time} onChange={(e) => updateSlot(slot.tempId, 'start_time', e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">End time</label>
                      <input type="time" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded text-sm" value={slot.end_time} onChange={(e) => updateSlot(slot.tempId, 'end_time', e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">Max people</label>
                      <input type="number" min="1" step="1" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded text-sm" value={slot.max_capacity} onChange={(e) => updateSlot(slot.tempId, 'max_capacity', e.target.value)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.tempId)}
                      disabled={timeSlots.length === 1}
                      className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-sm font-semibold px-2 py-2"
                      title={timeSlots.length === 1 ? 'At least one slot is required' : 'Remove this slot'}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg font-semibold bg-teal-700 dark:bg-teal-600 text-white hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors disabled:opacity-60">
              {submitting ? (editData ? 'Saving...' : 'Saving...') : (editData ? 'Save changes' : 'Register shop')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}