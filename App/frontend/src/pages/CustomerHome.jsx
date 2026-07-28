import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function CustomerHome() {
  // State for tabs and search functionality
  const [activeTab, setActiveTab] = useState('reserve'); // 'reserve' or 'myQueue'
  const [searchQuery, setSearchQuery] = useState('');

  // --- MOCK DATA ---
  // Once your backend is ready, we will replace these with useEffect fetch calls
  const availableShops = [
    { id: 1, name: 'Felyne Cafe', category: 'Restaurant', waitTime: '15 mins', deposit: 0 },
    { id: 2, name: 'City Dental Clinic', category: 'Healthcare', waitTime: '45 mins', deposit: 500 },
    { id: 3, name: 'Star Barber Shop', category: 'Salon', waitTime: '10 mins', deposit: 0 },
    { id: 4, name: 'Tech Fix Mobile', category: 'Service', waitTime: '30 mins', deposit: 100 },
  ];

  const myQueues = [
    { id: 101, shopName: 'Felyne Cafe', queueNumber: 'A-042', status: 'Waiting', estTime: '15 mins' }
  ];

  // Filter shops based on what the user types in the search bar
  const filteredShops = availableShops.filter(shop => 
    shop.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <Navbar userName="Customer" />

      <div className="max-w-5xl mx-auto p-8">
        {/* Tab Buttons */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('reserve')}
            className={`pb-3 px-4 font-medium text-lg transition-colors ${activeTab === 'reserve' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Find & Reserve
          </button>
          <button 
            onClick={() => setActiveTab('myQueue')}
            className={`pb-3 px-4 font-medium text-lg transition-colors ${activeTab === 'myQueue' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            My Queue
          </button>
        </div>

        {/* --- TAB CONTENT: RESERVE --- */}
        {activeTab === 'reserve' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <input 
                type="text" 
                placeholder="Search for a shop or clinic..." 
                className="w-full max-w-md border border-gray-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Shop Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.length > 0 ? (
                filteredShops.map((shop) => (
                  <div key={shop.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-gray-800">{shop.name}</h3>
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">{shop.category}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Current Wait: <span className="font-semibold text-orange-500">{shop.waitTime}</span></p>
                    
                    {shop.deposit > 0 && (
                      <p className="text-xs text-red-500 mb-4 bg-red-50 p-2 rounded border border-red-100">
                        Requires {shop.deposit}฿ deposit
                      </p>
                    )}

                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                      Join Queue
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 col-span-full">No shops found matching "{searchQuery}".</p>
              )}
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: MY QUEUE --- */}
        {activeTab === 'myQueue' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Active Tickets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myQueues.length > 0 ? (
                myQueues.map((queue) => (
                  <div key={queue.id} className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-800">{queue.shopName}</h3>
                      <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {queue.status}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-4 text-center border border-gray-200">
                      <p className="text-sm text-gray-500 uppercase tracking-wide">Queue Number</p>
                      <p className="text-3xl font-black text-blue-600">{queue.queueNumber}</p>
                    </div>

                    <p className="text-gray-600 text-sm text-center mb-4">
                      Estimated wait time: <span className="font-bold">{queue.estTime}</span>
                    </p>

                    <button className="w-full bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition-colors">
                      Cancel Reservation
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center col-span-full">
                  <p className="text-gray-500">You are not in any queues right now.</p>
                  <button 
                    onClick={() => setActiveTab('reserve')}
                    className="mt-4 text-blue-600 font-semibold hover:underline"
                  >
                    Find a shop to join
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}