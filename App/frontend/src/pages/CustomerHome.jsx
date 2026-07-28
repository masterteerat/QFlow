import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';

export default function CustomerHome() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState({});

  const [paymentModal, setPaymentModal] = useState(null); // business waiting on deposit payment
  const [ticket, setTicket] = useState(null); // booked ticket, shown as a confirmation card
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const data = await api.get('/customer/businesses');
      if (data.success) setBusinesses(data.data);
    } catch (error) {
      console.error('Fetch businesses error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = (businessId, slot) => {
    if (slot.is_booked) return;
    setSelectedSlots((prev) => ({ ...prev, [businessId]: slot.timeslot_id }));
  };

  const handleStartBooking = (business) => {
    const isWalkin = business.time_slots.length === 0;
    const slotId = selectedSlots[business.business_id] || null;

    if (!isWalkin && !slotId) {
      alert('Please pick a time slot first.');
      return;
    }

    if (business.is_deposit && Number(business.deposit_amount) > 0) {
      setPaymentModal({ business, slotId, amount: business.deposit_amount });
    } else {
      submitBooking(business.business_id, slotId, 0);
    }
  };

  const submitBooking = async (businessId, timeslotId, amountPaid) => {
    const customer = getCustomer();
    if (!customer?.id) {
      alert('Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post('/customer/tickets', {
        customer_id: customer.id,
        business_id: businessId,
        timeslot_id: timeslotId,
        amount_paid: amountPaid
      });

      if (result.success) {
        setPaymentModal(null);
        setTicket(result.data);
        setSelectedSlots({});
      } else {
        alert(result.message);
        setPaymentModal(null);
        fetchBusinesses(); // slot may have just been taken by someone else
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Could not reach the booking service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToHome = () => {
    setTicket(null);
    setSelectedSlots({});
    fetchBusinesses();
  };

  if (loading) return <div className="text-center p-8 text-slate-500">Loading shops...</div>;

  if (ticket) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 border-2 border-dashed border-teal-600 rounded-xl text-center shadow-sm bg-white">
        <h2 className="text-teal-700 text-xl font-bold mb-1">You're booked!</h2>
        <p className="text-slate-500 mb-5">Show this ticket to staff when you arrive.</p>

        <div className="bg-slate-50 rounded-lg p-5 my-5">
          <h1 className="text-5xl font-bold text-slate-800 my-2">{ticket.queue_number}</h1>
          <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-bold">
            {ticket.status_name}
          </span>
        </div>

        <div className="text-left space-y-2 border-t border-slate-100 pt-4">
          <p><span className="font-semibold">Shop:</span> {ticket.business_name}</p>
          <p><span className="font-semibold">Date:</span> {ticket.date}</p>
          <p>
            <span className="font-semibold">Time:</span>{' '}
            {ticket.start_time === '-' ? 'Walk-in (no set time)' : `${ticket.start_time.slice(0, 5)} - ${ticket.end_time.slice(0, 5)}`}
          </p>
          <p><span className="font-semibold">Ticket ID:</span> #{ticket.ticket_id}</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleBackToHome} className="flex-1 py-3 bg-slate-700 text-white rounded-md font-semibold hover:bg-slate-800 transition-colors">
            Back home
          </button>
          <Link to="/my-tickets" className="flex-1 py-3 bg-teal-700 text-white rounded-md font-semibold hover:bg-teal-800 transition-colors flex items-center justify-center">
            Track my tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-5 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Shops open for booking</h2>
        <Link to="/my-tickets" className="px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-bold">
          My tickets
        </Link>
      </div>

      {businesses.length === 0 ? (
        <p className="text-slate-500 mt-6">No shops are open for booking right now.</p>
      ) : (
        <div className="grid gap-5 mt-5">
          {businesses.map((b) => {
            const isWalkin = b.time_slots.length === 0;
            const allSlotsBooked = !isWalkin && b.time_slots.every((s) => s.is_booked);

            return (
              <div key={b.business_id} className="border border-slate-200 rounded-lg p-5 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-slate-800">{b.business_name}</h3>
                <p className="text-slate-600 text-sm mt-1">
                  Deposit: {b.is_deposit ? `฿${b.deposit_amount}` : 'None, book for free'}
                </p>

                <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Available times</h4>
                <div className="flex gap-2 flex-wrap">
                  {!isWalkin ? (
                    b.time_slots.map((slot) => {
                      const isSelected = selectedSlots[b.business_id] === slot.timeslot_id;
                      return (
                        <button
                          key={slot.timeslot_id}
                          onClick={() => handleSelectSlot(b.business_id, slot)}
                          disabled={slot.is_booked}
                          title={slot.is_booked ? 'This slot is already booked' : ''}
                          className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                            slot.is_booked
                              ? 'bg-slate-100 text-slate-400 line-through cursor-not-allowed'
                              : isSelected
                              ? 'bg-teal-50 border-teal-600 text-teal-800'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-teal-400'
                          }`}
                        >
                          {slot.date} ({slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)})
                          {slot.is_booked ? ' - full' : ''}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-emerald-700 font-semibold text-sm">
                      Walk-in only - no time to pick, just take a ticket
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleStartBooking(b)}
                  disabled={allSlotsBooked}
                  className={`mt-4 px-5 py-2 rounded-md font-semibold text-white transition-colors ${
                    allSlotsBooked ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {allSlotsBooked ? 'Fully booked' : isWalkin ? 'Take a ticket' : 'Confirm booking'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl max-w-sm w-full text-center shadow-lg">
            <h3 className="text-lg font-bold text-slate-800">Pay your deposit</h3>
            <p className="text-slate-500 mt-1">{paymentModal.business.business_name}</p>

            <div className="my-5 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Amount due</p>
              <h2 className="text-2xl font-bold text-rose-600 mt-1">฿{paymentModal.amount}</h2>
            </div>

            <div className="w-44 h-44 mx-auto border border-slate-200 rounded-lg p-2 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=PAYMENT-TEST-QFLOW-${paymentModal.amount}`}
                alt="Payment QR code"
                className="w-full h-full"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Test QR code - no real payment is made.</p>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPaymentModal(null)}
                disabled={submitting}
                className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-md font-semibold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submitBooking(paymentModal.business.business_id, paymentModal.slotId, paymentModal.amount)}
                disabled={submitting}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition-colors"
              >
                {submitting ? 'Saving...' : "I've paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
