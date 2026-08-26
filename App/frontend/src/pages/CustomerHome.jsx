import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';

// Normalize a date value to "YYYY-MM-DD"
const toDateKey = (d) => String(d).slice(0, 10);

// Friendly label for a date chip: Today / Tomorrow / "Wed 27"
const formatDateLabel = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);

  if (diffDays === 0) return { top: 'Today', bottom: `${date.getDate()}/${date.getMonth() + 1}` };
  if (diffDays === 1) return { top: 'Tomorrow', bottom: `${date.getDate()}/${date.getMonth() + 1}` };
  return {
    top: date.toLocaleDateString('en-US', { weekday: 'short' }),
    bottom: `${date.getDate()}/${date.getMonth() + 1}`
  };
};

export default function CustomerHome() {
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState({});
  const [selectedDates, setSelectedDates] = useState({});
  const [paxByBusiness, setPaxByBusiness] = useState({});

  // States for Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [queueTypeFilter, setQueueTypeFilter] = useState('all'); 
  const [depositFilter, setDepositFilter] = useState('all'); 
  const [categoryFilter, setCategoryFilter] = useState([]); 

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null); 
  const [ticket, setTicket] = useState(null); 

  const customer = getCustomer();
  const { toast } = useToast();

  
  const todayDateObj = new Date();
  todayDateObj.setHours(0, 0, 0, 0);
  
  const maxDateObj = new Date(todayDateObj);
  maxDateObj.setDate(todayDateObj.getDate() + 14);

  useEffect(() => {
    Promise.all([fetchBusinesses(), fetchCategories()]);
  }, []);

  const fetchBusinesses = async () => {
    try {
      const data = await api.get('/customer/businesses');
      if (data.success) setBusinesses(data.data);
    } catch (error) {
      console.error('Fetch businesses error:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await api.get('/customer/categories');
      if (data.success) setCategories(data.data);
    } catch (error) {
      console.error('Fetch categories error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (catId) => {
    setCategoryFilter((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch = b.business_name.toLowerCase().includes(searchQuery.toLowerCase());
    const isWalkin = b.time_slots.length === 0;
    const matchesQueueType = queueTypeFilter === 'all' || (queueTypeFilter === 'walkin' && isWalkin) || (queueTypeFilter === 'timeslot' && !isWalkin);
    const matchesDeposit = depositFilter === 'all' || (depositFilter === 'with-deposit' && b.is_deposit) || (depositFilter === 'no-deposit' && !b.is_deposit);
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(b.category_id);

    return matchesSearch && matchesQueueType && matchesDeposit && matchesCategory;
  });

  const clearAllFilters = () => {
    setQueueTypeFilter('all');
    setDepositFilter('all');
    setCategoryFilter([]); 
  };

  const handleSelectDate = (businessId, dateKey) => {
    setSelectedDates((prev) => ({ ...prev, [businessId]: dateKey }));
    setSelectedSlots((prev) => {
      const next = { ...prev };
      delete next[businessId];
      return next;
    });
  };

  const handleSelectSlot = (businessId, slot) => {
    if (slot.is_booked) return;
    setSelectedSlots((prev) => ({ ...prev, [businessId]: slot.timeslot_id }));
    setPaxByBusiness((prev) => {
      const current = prev[businessId] || 1;
      const clamped = Math.max(1, Math.min(current, slot.remaining));
      return { ...prev, [businessId]: clamped };
    });
  };

  const handleStartBooking = (business) => {
    const isWalkin = business.time_slots.length === 0;
    const slotId = selectedSlots[business.business_id] || null;
    const pax = paxByBusiness[business.business_id] || 1;

    if (!isWalkin && !slotId) {
      toast.warning('Please pick a time slot first.');
      return;
    }

    if (!isWalkin) {
      const slot = business.time_slots.find((s) => s.timeslot_id === slotId);
      if (slot && pax > slot.remaining) {
        toast.warning(`Only ${slot.remaining} spot${slot.remaining === 1 ? '' : 's'} left in this slot.`);
        return;
      }
    }

    if (business.is_deposit && Number(business.deposit_amount) > 0) {
      setPaymentModal({ business, slotId, amount: business.deposit_amount, pax });
    } else {
      submitBooking(business.business_id, slotId, 0, pax);
    }
  };

  const submitBooking = async (businessId, timeslotId, amountPaid, pax) => {
    if (!customer?.id) {
      toast.error('Please log in again.');
      return;
    }

    try {
      const result = await api.post('/customer/tickets', {
        customer_id: customer.id,
        business_id: businessId,
        timeslot_id: timeslotId,
        amount_paid: amountPaid,
        pax
      });

      if (result.success) {
        setPaymentModal(null);
        setTicket(result.data);
        setSelectedSlots({});
      } else {
        toast.error(result.message);
        setPaymentModal(null);
        fetchBusinesses(); 
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Could not reach the booking service.');
    }
  };

  const handleBackToHome = () => {
    setTicket(null);
    setSelectedSlots({});
    fetchBusinesses();
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar userName={customer?.fname} />
      <div className="max-w-3xl mx-auto p-5">
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
          <div className="bg-teal-600 dark:bg-teal-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
        </div>
        <div className="text-center text-slate-500 dark:text-slate-400">Loading shops...</div>
      </div>
    </div>
  );

  if (ticket) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <Navbar userName={customer?.fname} />
        <div className="max-w-md mx-auto mt-10 p-8 border-2 border-dashed border-teal-600 dark:border-teal-500 rounded-xl text-center shadow-sm bg-white dark:bg-slate-800 transition-colors duration-300">
          <h2 className="text-teal-700 dark:text-teal-400 text-xl font-bold mb-1">You're booked!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-5">Show this ticket to staff when you arrive.</p>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-5 my-5 transition-colors duration-300">
            <h1 className="text-5xl font-bold text-slate-800 dark:text-white my-2">{ticket.queue_number}</h1>
            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-bold">
              {ticket.status_name}
            </span>
          </div>

          <div className="text-left space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4 text-slate-700 dark:text-slate-300">
            <p><span className="font-semibold text-slate-800 dark:text-white">Shop:</span> {ticket.business_name}</p>
            
            {ticket.start_time === '-' ? (
              <p>
                <span className="font-semibold text-slate-800 dark:text-white">Booked on:</span>{' '}
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                }) : '-'}
              </p>
            ) : (
              <>
                <p>
                  <span className="font-semibold text-slate-800 dark:text-white">Date:</span>{' '}
                  {ticket.date ? new Date(ticket.date).toLocaleDateString('en-GB') : '-'}
                </p>
                <p>
                  <span className="font-semibold text-slate-800 dark:text-white">Time:</span>{' '}
                  {`${ticket.start_time.slice(0, 5)} - ${ticket.end_time.slice(0, 5)}`}
                </p>
              </>
            )}

            <p><span className="font-semibold text-slate-800 dark:text-white">Ticket ID:</span> #{ticket.ticket_id}</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleBackToHome} className="flex-1 py-3 bg-slate-700 dark:bg-slate-600 text-white rounded-md font-semibold hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors">
              Back home
            </button>
            <Link to="/tickets" className="flex-1 py-3 bg-teal-700 dark:bg-teal-600 text-white rounded-md font-semibold hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors flex items-center justify-center">
              Track my tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeFilterCount = (queueTypeFilter !== 'all' ? 1 : 0) + (depositFilter !== 'all' ? 1 : 0) + categoryFilter.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar userName={customer?.fname} />
      
      <div className="max-w-3xl mx-auto p-5 relative">
        <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Shops open for booking</h2>
          <div className="flex gap-2">
            <Link to="/schedule" className="px-4 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-sm font-bold">
              My schedule
            </Link>
            <Link to="/tickets" className="px-4 py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-bold">
              My tickets
            </Link>
          </div>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-4 mb-5 relative">
          <div className="bg-teal-600 dark:bg-teal-500 h-2 rounded-full transition-all duration-500" style={{ width: `${businesses.length > 0 ? (filteredBusinesses.length / businesses.length) * 100 : 0}%` }}></div>
          <span className="absolute right-0 -top-5 text-xs text-slate-500 dark:text-slate-400 font-semibold">{businesses.length > 0 ? Math.round((filteredBusinesses.length / businesses.length) * 100) : 0}%</span>
        </div>

        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors border ${
              activeFilterCount > 0 ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-600 dark:border-teal-500 text-teal-800 dark:text-teal-400' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-teal-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters {activeFilterCount > 0 && <span className="bg-teal-600 dark:bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>}
          </button>
        </div>

        {(searchQuery || activeFilterCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Active:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold flex items-center gap-1">
                "{searchQuery}" <button onClick={() => setSearchQuery('')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {queueTypeFilter !== 'all' && (
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold flex items-center gap-1">
                {queueTypeFilter === 'walkin' ? 'Walk-in' : 'Timeslot'} <button onClick={() => setQueueTypeFilter('all')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {depositFilter !== 'all' && (
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold flex items-center gap-1">
                {depositFilter === 'with-deposit' ? 'With deposit' : 'No deposit'} <button onClick={() => setDepositFilter('all')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {categoryFilter.map((catId) => {
              const catObj = categories.find((c) => c.category_id === catId);
              return (
                <span key={catId} className="px-3 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 rounded-full text-xs font-semibold flex items-center gap-1">
                  {catObj?.name || 'Category'} <button onClick={() => handleCategoryToggle(catId)} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
                </span>
              );
            })}
          </div>
        )}

        {showFilterModal && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 transition-opacity">
            <div className="bg-white dark:bg-slate-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[85vh] transition-colors duration-300">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 sm:rounded-t-xl rounded-t-2xl transition-colors duration-300">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Filter Shops</h3>
                <button onClick={() => setShowFilterModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
              </div>

              <div className="p-5 overflow-y-auto flex flex-col gap-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Category (Select Multiple)</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setCategoryFilter([])}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                        categoryFilter.length === 0 ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-teal-400'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((c) => {
                      const isSelected = categoryFilter.includes(c.category_id);
                      return (
                        <button
                          key={c.category_id}
                          onClick={() => handleCategoryToggle(c.category_id)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                            isSelected ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-teal-400'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Queue Type</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setQueueTypeFilter('all')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'all' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>Both</button>
                    <button onClick={() => setQueueTypeFilter('walkin')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'walkin' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>Walk-in</button>
                    <button onClick={() => setQueueTypeFilter('timeslot')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'timeslot' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>Timeslot</button>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Deposit Required</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDepositFilter('all')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'all' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>Both</button>
                    <button onClick={() => setDepositFilter('no-deposit')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'no-deposit' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>No Deposit</button>
                    <button onClick={() => setDepositFilter('with-deposit')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'with-deposit' ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>With Deposit</button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-800 rounded-b-xl transition-colors duration-300">
                <button onClick={clearAllFilters} className="px-5 py-3 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  Clear All
                </button>
                <button onClick={() => setShowFilterModal(false)} className="flex-1 py-3 rounded-lg font-bold bg-teal-700 dark:bg-teal-600 text-white hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors shadow-md">
                  Show {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Shop' : 'Shops'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 mb-2">
          {filteredBusinesses.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">
              {filteredBusinesses.length} shop{filteredBusinesses.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="mt-8 text-center bg-slate-50 dark:bg-slate-800 rounded-xl p-10 border border-dashed border-slate-200 dark:border-slate-700 transition-colors duration-300">
            <svg className="mx-auto w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-slate-600 dark:text-slate-300 text-lg font-bold">No shops found</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Try adjusting your filters or search query.</p>
            <button onClick={clearAllFilters} className="mt-4 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 mt-2">
            {filteredBusinesses.map((b) => {
              const isWalkin = b.time_slots.length === 0;

              
              const availableDates = isWalkin
                ? []
                : [...new Set(b.time_slots.map((s) => toDateKey(s.date)))]
                    .filter((dateKey) => {
                      const [y, m, d] = dateKey.split('-').map(Number);
                      const slotDate = new Date(y, m - 1, d);
                      return slotDate >= todayDateObj && slotDate <= maxDateObj;
                    })
                    .sort();

              const selectedDate = selectedDates[b.business_id] || availableDates[0];
              const slotsForDate = isWalkin
                ? []
                : b.time_slots.filter((s) => toDateKey(s.date) === selectedDate);

              const allSlotsBookedForDate = !isWalkin && slotsForDate.length > 0 && slotsForDate.every((s) => s.is_booked);

              const selectedSlotObj = !isWalkin
                ? b.time_slots.find((s) => s.timeslot_id === selectedSlots[b.business_id])
                : null;
              const maxPax = selectedSlotObj ? selectedSlotObj.remaining : null;
              const currentPax = paxByBusiness[b.business_id] || 1;

              return (
                <div key={b.business_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">{b.business_name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold rounded">
                        {b.category_name}
                      </span>
                    </div>
                    {b.is_deposit ? (
                      <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded text-xs font-bold border border-amber-100 dark:border-amber-800">Deposit: ฿{b.deposit_amount}</span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs font-bold border border-emerald-100 dark:border-emerald-800">Free booking</span>
                    )}
                  </div>

                  {!isWalkin && availableDates.length > 0 && (
                    <>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-5 mb-2">Pick a date</h4>
                      <div className="flex gap-2 flex-wrap">
                        {availableDates.map((dateKey) => {
                          const label = formatDateLabel(dateKey);
                          const isActive = dateKey === selectedDate;
                          return (
                            <button
                              key={dateKey}
                              onClick={() => handleSelectDate(b.business_id, dateKey)}
                              className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-semibold border min-w-[56px] transition-colors ${
                                isActive
                                  ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-600 text-white'
                                  : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-teal-400'
                              }`}
                            >
                              <span>{label.top}</span>
                              <span className={isActive ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}>{label.bottom}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!isWalkin && availableDates.length === 0 && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-4">No available timeslots for the next 14 days.</p>
                  )}

                  {(isWalkin || availableDates.length > 0) && (
                    <>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">
                        {isWalkin ? 'Available times' : 'Available times on this date'}
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        {!isWalkin ? (
                          slotsForDate.map((slot) => {
                            const isSelected = selectedSlots[b.business_id] === slot.timeslot_id;
                            return (
                              <button
                                key={slot.timeslot_id}
                                onClick={() => handleSelectSlot(b.business_id, slot)}
                                disabled={slot.is_booked}
                                title={slot.is_booked ? 'This slot is already booked' : ''}
                                className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                                  slot.is_booked
                                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 line-through cursor-not-allowed border-slate-200 dark:border-slate-700'
                                    : isSelected
                                    ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-600 dark:border-teal-500 text-teal-800 dark:text-teal-300 shadow-sm'
                                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-teal-400'
                                }`}
                              >
                                {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                                {slot.is_booked ? ' - full' : ` - ${slot.remaining} left`}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Walk-in only - take a ticket immediately
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          People{maxPax !== null ? ` (max ${maxPax} left)` : ''}:
                        </span>
                        <button
                          type="button"
                          onClick={() => setPaxByBusiness((p) => ({ ...p, [b.business_id]: Math.max(1, (p[b.business_id] || 1) - 1) }))}
                          className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800 dark:text-white">{currentPax}</span>
                        <button
                          type="button"
                          disabled={maxPax !== null && currentPax >= maxPax}
                          onClick={() => setPaxByBusiness((p) => {
                            const next = (p[b.business_id] || 1) + 1;
                            return { ...p, [b.business_id]: maxPax !== null ? Math.min(next, maxPax) : next };
                          })}
                          className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => handleStartBooking(b)}
                        disabled={!isWalkin && allSlotsBookedForDate}
                        className={`mt-5 w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-sm ${
                          (!isWalkin && allSlotsBookedForDate) ? 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed' : 'bg-teal-700 dark:bg-teal-600 hover:bg-teal-800 dark:hover:bg-teal-700'
                        }`}
                      >
                        {(!isWalkin && allSlotsBookedForDate) ? 'Fully booked on this date' : isWalkin ? 'Take a ticket' : 'Confirm booking'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {paymentModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl max-w-sm w-full text-center shadow-lg transition-colors duration-300">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Pay your deposit</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{paymentModal.business.business_name}</p>

              <div className="my-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors duration-300">
                <p className="text-sm text-slate-500 dark:text-slate-400">Amount due</p>
                <h2 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">฿{paymentModal.amount}</h2>
              </div>

              <div className="w-44 h-44 mx-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex items-center justify-center bg-white">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=PAYMENT-TEST-QFLOW-${paymentModal.amount}`}
                  alt="Payment QR code"
                  className="w-full h-full"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPaymentModal(null)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitBooking(paymentModal.business.business_id, paymentModal.slotId, paymentModal.amount, paymentModal.pax)}
                  className="flex-1 py-2.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors"
                >
                  Paid
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}