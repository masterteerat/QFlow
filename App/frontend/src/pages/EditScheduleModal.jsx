import { useState, useEffect } from 'react';
import { api } from '../lib/api';

let tempIdCounter = 0;
const nextTempId = () => `slot-${++tempIdCounter}-${Date.now()}`;
const emptySlot = () => ({ tempId: nextTempId(), start_time: '', end_time: '', max_capacity: 1 });

export default function EditScheduleModal({ businessId, onClose, onSuccess }) {
  const [timeSlots, setTimeSlots] = useState([emptySlot()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/owner/businesses/${businessId}/schedule`).then((res) => {
      if (res.success && res.data.length > 0) {
        setTimeSlots(res.data.map((s) => ({
          tempId: nextTempId(),
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
          max_capacity: s.max_capacity
        })));
      }
      setLoading(false);
    }).catch(() => { setError('Could not load current schedule.'); setLoading(false); });
  }, [businessId]);

  const updateSlot = (tempId, field, value) => {
    setTimeSlots((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  };
  const addSlot = () => setTimeSlots((prev) => [...prev, emptySlot()]);
  const removeSlot = (tempId) => setTimeSlots((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.tempId !== tempId)));

  const validate = () => {
    for (const slot of timeSlots) {
      if (!slot.start_time || !slot.end_time) return 'Please fill in every time slot.';
      if (slot.start_time >= slot.end_time) return 'Start time must be before end time.';
      if (!slot.max_capacity || Number(slot.max_capacity) < 1) return 'Each slot needs a max capacity of at least 1.';
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
      const result = await api.put(`/owner/businesses/${businessId}/schedule`, {
        time_slots: timeSlots.map(({ start_time, end_time, max_capacity }) => ({ start_time, end_time, max_capacity: Number(max_capacity) }))
      });
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Edit daily schedule</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none" aria-label="Close">
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading current schedule...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded text-sm border border-rose-200 dark:border-rose-800">{error}</div>}
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Changes apply to the next 14 days. Slots that already have a booking are kept as-is.
            </p>

            <div className="flex justify-between items-center">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold">Daily time blocks</label>
              <button type="button" onClick={addSlot} className="text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 text-sm font-semibold">
                + Add block
              </button>
            </div>

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
                    title={timeSlots.length === 1 ? 'At least one block is required' : 'Remove this block'}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-2">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg font-semibold bg-teal-700 dark:bg-teal-600 text-white hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : 'Save schedule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
