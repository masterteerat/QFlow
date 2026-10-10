import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';
import Navbar from '../components/Navbar';
import BanNotice from '../components/BanNotice';
import { useToast } from '../context/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { fmtDate } from '../lib/date';
import { fmtMoney } from '../lib/money';
import { Perf, StatusPill } from '../components/TicketParts';

function ShopThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const isDefault = !src || /default-business/.test(src);

  if (!src || failed) {
    return (
      <div className="w-full h-36 shrink-0 bg-ink-200 dark:bg-ink-700 flex items-center justify-center">
        <svg className="w-10 h-10 text-ink-400 dark:text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-36 shrink-0 overflow-hidden bg-ink-100 dark:bg-ink-900 flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`block w-full h-full ${isDefault ? 'object-contain' : 'object-cover'}`}
      />
    </div>
  );
}

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
  const [sheetId, setSheetId] = useState(null);

  const customer = getCustomer();
  const { toast } = useToast();

  // the confirmation page replaces the list, so start it at the top
  useEffect(() => { if (ticket) window.scrollTo(0, 0); }, [ticket]);

  
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

  const todayDateObj = new Date();
  todayDateObj.setHours(0, 0, 0, 0);
  
  const maxDateObj = new Date(todayDateObj);
  maxDateObj.setDate(todayDateObj.getDate() + 14);

  useEffect(() => {
    Promise.all([fetchBusinesses(), fetchCategories()]);
  }, []);

  const handleCategoryToggle = (catId) => {
    setCategoryFilter((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch = b.business_name.toLowerCase().includes(searchQuery.toLowerCase());
    const isWalkin = b.queue_type === 'walkin';
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
    const isWalkin = business.queue_type === 'walkin';
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
        business_id: businessId,
        timeslot_id: timeslotId,
        pax
      });

      if (result.success) {
        setPaymentModal(null);
        setTicket(result.data);
        setSheetId(null);
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
    setSheetId(null);
    setSelectedSlots({});
    fetchBusinesses();
  };

  if (loading) return (
    <div className="min-h-screen">
      <Navbar userName={customer?.fname} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="h-8 w-56 rounded-lg bg-ink-200 dark:bg-ink-700 animate-pulse" />
        <div className="h-12 mt-5 rounded-2xl bg-ink-200 dark:bg-ink-700 animate-pulse" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-2xl bg-ink-200/70 dark:bg-ink-800 animate-pulse" />)}
        </div>
      </div>
    </div>
  );

  if (ticket) {
    const timed = ticket.start_time && ticket.start_time !== '-';
    return (
      <div className="min-h-screen">
        <Navbar userName={customer?.fname} />
        <div className="max-w-sm mx-auto px-4 pt-8 pb-10">
          <div className="text-center mb-5">
            <span className="inline-flex w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 items-center justify-center text-2xl">✓</span>
            <h1 className="font-display text-3xl font-extrabold text-ink-900 dark:text-white mt-3">You're in!</h1>
            <p className="text-ink-500 dark:text-ink-400 mt-1">Show this ticket to the staff when you arrive.</p>
          </div>

          <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-3xl shadow-md p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-ink-900 dark:text-white">{ticket.business_name}</p>
              <StatusPill status={ticket.status_name} />
            </div>
            <div className="qnum text-7xl text-center text-ink-900 dark:text-white my-5">{ticket.queue_number}</div>

            <Perf />

            {ticket.qr_payload && (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white p-3 rounded-2xl border border-ink-200">
                  <QRCodeSVG value={ticket.qr_payload} size={168} level="H" />
                </div>
                <p className="text-ink-400 text-xs">Show this QR code to staff to check in</p>
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{timed ? 'Date' : 'Queue'}</dt>
                <dd className="font-bold text-ink-900 dark:text-white">{timed ? fmtDate(ticket.date) : 'Walk-in'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{timed ? 'Time' : 'Joined'}</dt>
                <dd className="font-bold text-ink-900 dark:text-white">
                  {timed
                    ? `${ticket.start_time.slice(0, 5)}–${ticket.end_time.slice(0, 5)}`
                    : ticket.created_at ? new Date(ticket.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleBackToHome} className="flex-1 py-3.5 rounded-2xl font-bold border border-ink-300 dark:border-ink-600 text-ink-800 dark:text-ink-100 bg-white dark:bg-ink-800 hover:border-brand-400">
              Back to shops
            </button>
            <Link to="/tickets" className="flex-1 py-3.5 rounded-2xl font-bold bg-brand-700 hover:bg-brand-800 text-white text-center shadow-sm">
              My tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeFilterCount = (queueTypeFilter !== 'all' ? 1 : 0) + (depositFilter !== 'all' ? 1 : 0) + categoryFilter.length;

  // Everything a card or the booking sheet needs to know about one shop
  const getShopView = (b) => {
    const isWalkin = b.queue_type === 'walkin';
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
    const slotsForDate = isWalkin ? [] : b.time_slots.filter((s) => toDateKey(s.date) === selectedDate);
    const allSlotsBookedForDate = !isWalkin && slotsForDate.length > 0 && slotsForDate.every((s) => s.is_booked);
    const selectedSlotObj = !isWalkin ? b.time_slots.find((s) => s.timeslot_id === selectedSlots[b.business_id]) : null;
    const maxPax = selectedSlotObj ? selectedSlotObj.remaining : null;
    const currentPax = paxByBusiness[b.business_id] || 1;
    // earliest slot that still has room, for the "Next:" line on the card
    let nextSlot = null;
    if (!isWalkin) {
      const open = b.time_slots
        .filter((s) => !s.is_booked && availableDates.includes(toDateKey(s.date)))
        .sort((a, c) => (toDateKey(a.date) + a.start_time).localeCompare(toDateKey(c.date) + c.start_time));
      nextSlot = open[0] || null;
    }
    return { isWalkin, availableDates, selectedDate, slotsForDate, allSlotsBookedForDate, selectedSlotObj, maxPax, currentPax, nextSlot };
  };

  const sheetShop = sheetId ? businesses.find((b) => b.business_id === sheetId) : null;
  const chipCls = (active) =>
    `shrink-0 px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap ${
      active
        ? 'bg-ink-900 dark:bg-brand-600 text-white border-ink-900 dark:border-brand-600'
        : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 border-ink-200 dark:border-ink-700 hover:border-brand-400'
    }`;

  return (
    <div className="min-h-screen">
      <Navbar userName={customer?.fname} />
      <BanNotice />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 relative">
        <p className="text-sm font-bold text-brand-700 dark:text-brand-300">Hi {customer?.fname || 'there'} 👋</p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white mt-1 tracking-tight">Find your next queue</h1>

        <div className="flex gap-3 mt-5">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
            </svg>
            <input
              type="text"
              placeholder="Search shops"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 sm:px-5 rounded-2xl font-bold border ${
              activeFilterCount > 0 ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500 text-brand-800 dark:text-brand-300' : 'bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-brand-400'
            }`}
            aria-label="Open filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && <span className="bg-brand-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>

        {categories.length > 0 && (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setCategoryFilter([])} className={chipCls(categoryFilter.length === 0)}>All</button>
            {categories.map((c) => (
              <button key={c.category_id} onClick={() => handleCategoryToggle(c.category_id)} className={chipCls(categoryFilter.includes(c.category_id))}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {(searchQuery || activeFilterCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
            <span className="text-ink-500 dark:text-ink-400">Active:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-300 rounded-full text-xs font-semibold flex items-center gap-1">
                "{searchQuery}" <button onClick={() => setSearchQuery('')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {queueTypeFilter !== 'all' && (
              <span className="px-3 py-1 bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-300 rounded-full text-xs font-semibold flex items-center gap-1">
                {queueTypeFilter === 'walkin' ? 'Walk-in' : 'Timeslot'} <button onClick={() => setQueueTypeFilter('all')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {depositFilter !== 'all' && (
              <span className="px-3 py-1 bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-300 rounded-full text-xs font-semibold flex items-center gap-1">
                {depositFilter === 'with-deposit' ? 'With deposit' : 'No deposit'} <button onClick={() => setDepositFilter('all')} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
              </span>
            )}
            {categoryFilter.map((catId) => {
              const catObj = categories.find((c) => c.category_id === catId);
              return (
                <span key={catId} className="px-3 py-1 bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-300 rounded-full text-xs font-semibold flex items-center gap-1">
                  {catObj?.name || 'Category'} <button onClick={() => handleCategoryToggle(catId)} className="hover:text-rose-600 dark:hover:text-rose-400 text-lg leading-none">&times;</button>
                </span>
              );
            })}
          </div>
        )}

        {showFilterModal && (
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 transition-opacity">
            <div className="bg-white dark:bg-ink-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[85vh] transition-colors duration-300">
              <div className="p-5 border-b border-ink-100 dark:border-ink-700 flex justify-between items-center sticky top-0 bg-white dark:bg-ink-800 sm:rounded-t-xl rounded-t-2xl transition-colors duration-300">
                <h3 className="text-xl font-bold text-ink-800 dark:text-white">Filter Shops</h3>
                <button onClick={() => setShowFilterModal(false)} className="text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 text-2xl leading-none">&times;</button>
              </div>

              <div className="p-5 overflow-y-auto flex flex-col gap-6">
                <div>
                  <h4 className="font-bold text-ink-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Category (Select Multiple)</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setCategoryFilter([])}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                        categoryFilter.length === 0 ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600 hover:border-brand-400'
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
                            isSelected ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600 hover:border-brand-400'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-ink-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Queue Type</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setQueueTypeFilter('all')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'all' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>Both</button>
                    <button onClick={() => setQueueTypeFilter('walkin')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'walkin' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>Walk-in</button>
                    <button onClick={() => setQueueTypeFilter('timeslot')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${queueTypeFilter === 'timeslot' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>Timeslot</button>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-ink-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Deposit Required</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDepositFilter('all')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'all' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>Both</button>
                    <button onClick={() => setDepositFilter('no-deposit')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'no-deposit' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>No Deposit</button>
                    <button onClick={() => setDepositFilter('with-deposit')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border ${depositFilter === 'with-deposit' ? 'bg-brand-700 dark:bg-brand-600 text-white border-brand-700 dark:border-brand-600' : 'bg-ink-50 dark:bg-ink-700 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'}`}>With Deposit</button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-ink-100 dark:border-ink-700 flex gap-3 sticky bottom-0 bg-white dark:bg-ink-800 rounded-b-xl transition-colors duration-300">
                <button onClick={clearAllFilters} className="px-5 py-3 rounded-lg font-semibold bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors">
                  Clear All
                </button>
                <button onClick={() => setShowFilterModal(false)} className="flex-1 py-3 rounded-lg font-bold bg-brand-700 dark:bg-brand-600 text-white hover:bg-brand-800 dark:hover:bg-brand-700 transition-colors shadow-md">
                  Show {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Shop' : 'Shops'}
                </button>
              </div>
            </div>
          </div>
        )}


        <div className="flex items-center justify-between mt-6 mb-3">
          <span className="text-sm text-ink-500 dark:text-ink-400 font-semibold">
            {filteredBusinesses.length} shop{filteredBusinesses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="mt-6 text-center bg-white dark:bg-ink-800 rounded-3xl p-12 border border-dashed border-ink-300 dark:border-ink-600">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-ink-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" /></svg>
            </div>
            <p className="font-display text-xl font-bold text-ink-900 dark:text-white">No shops match</p>
            <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Try a different search or clear your filters.</p>
            <button onClick={() => { clearAllFilters(); setSearchQuery(''); }} className="mt-5 px-5 py-2.5 rounded-xl bg-ink-900 dark:bg-brand-600 text-white font-bold">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBusinesses.map((b) => {
              const v = getShopView(b);
              const unavailable = !v.isWalkin && !v.nextSlot;
              return (
                <article key={b.business_id} className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col">
                  <div className="relative">
                    <ShopThumbnail src={b.image} alt={b.business_name} />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 text-ink-800 text-xs font-bold shadow-sm">
                      {v.isWalkin ? 'Walk-in' : 'Time slots'}
                    </span>
                    <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${b.is_deposit ? 'bg-ink-900 text-white' : 'bg-emerald-600 text-white'}`}>
                      {b.is_deposit ? `฿${fmtMoney(b.deposit_amount)} deposit` : 'Free'}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">{b.category_name}</p>
                    <h3 className="font-display text-lg font-bold leading-snug text-ink-900 dark:text-white mt-0.5">{b.business_name}</h3>
                    {b.description && <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2 mt-1.5">{b.description}</p>}

                    <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                      <div className="text-sm min-w-0">
                        {v.isWalkin ? (
                          <span className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Take a ticket now
                          </span>
                        ) : v.nextSlot ? (
                          <>
                            <span className="block text-xs font-semibold text-ink-500 dark:text-ink-400">Next available</span>
                            <span className="block font-bold text-ink-900 dark:text-white truncate">
                              {formatDateLabel(toDateKey(v.nextSlot.date)).top} · {v.nextSlot.start_time.slice(0, 5)}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-ink-500 dark:text-ink-400">Fully booked</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSheetId(b.business_id)}
                        disabled={unavailable}
                        className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-white ${unavailable ? 'bg-ink-300 dark:bg-ink-600 cursor-not-allowed' : 'bg-brand-700 hover:bg-brand-800 shadow-sm'}`}
                      >
                        {v.isWalkin ? 'Join queue' : 'Book'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {sheetShop && (() => {
          const b = sheetShop;
          const v = getShopView(b);
          const hasDeposit = b.is_deposit && Number(b.deposit_amount) > 0;
          const needsSlot = !v.isWalkin && !v.selectedSlotObj;
          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSheetId(null)}>
              <div
                className="w-full sm:max-w-lg bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] flex flex-col animate-sheet-up"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`Book ${b.business_name}`}
              >
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">{b.category_name}</p>
                    <h2 className="font-display text-2xl font-extrabold text-ink-900 dark:text-white leading-tight">{b.business_name}</h2>
                  </div>
                  <button onClick={() => setSheetId(null)} aria-label="Close" className="w-9 h-9 shrink-0 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-200 text-xl leading-none">&times;</button>
                </div>

                <div className="px-5 pb-4 overflow-y-auto">
                  {v.isWalkin ? (
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                      <p className="font-bold">Walk-in queue</p>
                      <p className="mt-0.5">You get a ticket right away. Show the QR code to the staff when you arrive.</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">Day</h3>
                      <div className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {v.availableDates.map((dk) => {
                          const lab = formatDateLabel(dk);
                          const on = dk === v.selectedDate;
                          return (
                            <button
                              key={dk}
                              onClick={() => handleSelectDate(b.business_id, dk)}
                              className={`shrink-0 min-w-[4.75rem] px-2 py-2.5 rounded-2xl border text-center ${on ? 'bg-ink-900 dark:bg-brand-600 border-ink-900 dark:border-brand-600 text-white' : 'bg-white dark:bg-ink-700 border-ink-200 dark:border-ink-600 text-ink-800 dark:text-ink-100 hover:border-brand-400'}`}
                            >
                              <span className="block text-[10px] leading-4 font-bold uppercase tracking-wide opacity-80">{lab.top}</span>
                              <span className="block text-lg font-extrabold font-display">{dk.slice(8, 10)}</span>
                            </button>
                          );
                        })}
                      </div>

                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mt-5 mb-2">Time</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {v.slotsForDate.map((slot) => {
                          const on = selectedSlots[b.business_id] === slot.timeslot_id;
                          return (
                            <button
                              key={slot.timeslot_id}
                              onClick={() => handleSelectSlot(b.business_id, slot)}
                              disabled={slot.is_booked}
                              className={`px-3 py-3 rounded-2xl border text-left ${
                                slot.is_booked
                                  ? 'bg-ink-50 dark:bg-ink-900 border-ink-200 dark:border-ink-700 text-ink-400 cursor-not-allowed'
                                  : on
                                  ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-600 ring-2 ring-brand-600/20 text-brand-900 dark:text-brand-200'
                                  : 'bg-white dark:bg-ink-700 border-ink-200 dark:border-ink-600 text-ink-800 dark:text-ink-100 hover:border-brand-400'
                              }`}
                            >
                              <span className={`block qnum text-base ${slot.is_booked ? 'line-through' : ''}`}>{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span>
                              <span className="block text-xs font-semibold mt-0.5 opacity-80">{slot.is_booked ? 'Full' : `${slot.remaining} left`}</span>
                            </button>
                          );
                        })}
                      </div>
                      {v.slotsForDate.length === 0 && <p className="text-sm text-ink-500 dark:text-ink-400">No times on this day.</p>}
                    </>
                  )}

                  <div className="mt-5 flex items-center justify-between rounded-2xl bg-ink-50 dark:bg-ink-900/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-ink-900 dark:text-white">Party size</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{v.maxPax !== null ? `Up to ${v.maxPax} in this slot` : 'How many people?'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Fewer people"
                        onClick={() => setPaxByBusiness((p) => ({ ...p, [b.business_id]: Math.max(1, (p[b.business_id] || 1) - 1) }))}
                        className="w-10 h-10 rounded-full bg-white dark:bg-ink-700 border border-ink-200 dark:border-ink-600 text-xl font-bold text-ink-700 dark:text-ink-100"
                      >−</button>
                      <span className="w-6 text-center qnum text-xl text-ink-900 dark:text-white">{v.currentPax}</span>
                      <button
                        type="button"
                        aria-label="More people"
                        disabled={v.maxPax !== null && v.currentPax >= v.maxPax}
                        onClick={() => setPaxByBusiness((p) => {
                          const next = (p[b.business_id] || 1) + 1;
                          return { ...p, [b.business_id]: v.maxPax !== null ? Math.min(next, v.maxPax) : next };
                        })}
                        className="w-10 h-10 rounded-full bg-white dark:bg-ink-700 border border-ink-200 dark:border-ink-600 text-xl font-bold text-ink-700 dark:text-ink-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                  </div>
                </div>

                <div className="px-5 pt-3 border-t border-ink-100 dark:border-ink-700" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                  {hasDeposit && <p className="text-xs text-ink-500 dark:text-ink-400 mb-2">Deposit of <b className="text-ink-800 dark:text-ink-100">฿{fmtMoney(b.deposit_amount)}</b> is paid in the next step.</p>}
                  <button
                    onClick={() => handleStartBooking(b)}
                    disabled={needsSlot || v.allSlotsBookedForDate}
                    className={`w-full py-3.5 rounded-2xl font-extrabold text-white text-base ${needsSlot || v.allSlotsBookedForDate ? 'bg-ink-300 dark:bg-ink-600 cursor-not-allowed' : 'bg-brand-700 hover:bg-brand-800 shadow-md'}`}
                  >
                    {v.isWalkin ? (hasDeposit ? `Continue · ฿${fmtMoney(b.deposit_amount)}` : 'Join the queue') : needsSlot ? 'Choose a time' : hasDeposit ? `Continue · ฿${fmtMoney(b.deposit_amount)}` : 'Confirm booking'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {paymentModal && (
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-ink-800 p-8 rounded-3xl max-w-sm w-full text-center shadow-lg transition-colors duration-300">
              <h3 className="text-lg font-bold text-ink-800 dark:text-white">Pay your deposit</h3>
              <p className="text-ink-500 dark:text-ink-400 mt-1">{paymentModal.business.business_name}</p>

              <div className="my-5 p-4 bg-ink-50 dark:bg-ink-900 rounded-lg transition-colors duration-300">
                <p className="text-sm text-ink-500 dark:text-ink-400">Amount due (demo payment, no real money is charged)</p>
                <h2 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">฿{fmtMoney(paymentModal.amount)}</h2>
              </div>

              <div className="w-44 h-44 mx-auto border border-ink-200 dark:border-ink-700 rounded-lg p-2 flex items-center justify-center bg-white">
                <QRCodeSVG value={`QFLOW-DEMO-PAYMENT-${paymentModal.amount}`} size={160} />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPaymentModal(null)}
                  className="flex-1 py-2.5 border border-ink-300 dark:border-ink-600 text-ink-700 dark:text-ink-300 rounded-lg font-semibold hover:bg-ink-50 dark:hover:bg-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitBooking(paymentModal.business.business_id, paymentModal.slotId, paymentModal.amount, paymentModal.pax)}
                  className="flex-1 py-2.5 bg-brand-700 dark:bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-800 dark:hover:bg-brand-700 transition-colors"
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
