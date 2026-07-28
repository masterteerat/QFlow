import { useState } from 'react';
import Navbar from '../components/Navbar';

export default function OwnerHome() {
  // State to track which shop the owner is currently viewing
  const [selectedShop, setSelectedShop] = useState(null);

  // --- MOCK DATA ---
  const myShops = [
    { 
      id: 1, 
      name: 'Hakum Village Cafe', 
      category: 'Restaurant', 
      status: 'Open', 
      queueCount: 12, 
      queueType: 'Walk-in & VIP' 
    },
    { 
      id: 2, 
      name: 'Rider\'s Forge', 
      category: 'Service', 
      status: 'Closed', 
      queueCount: 0, 
      queueType: 'Walk-in Only' 
    }
  ];

  const activeQueue = [
    { id: 101, ticket: 'A-042', name: 'Alex M.', partySize: 2, type: 'Walk-in', timeWaited: '15 mins' },
    { id: 102, ticket: 'A-043', name: 'Emma W.', partySize: 4, type: 'Walk-in', timeWaited: '10 mins' },
    { id: 103, ticket: 'V-001', name: 'Bruce W.', partySize: 1, type: 'VIP', timeWaited: '2 mins' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName="Shop Owner" />

      <div className="max-w-6xl mx-auto p-8">
        
        {/* --- VIEW 1: SHOP SELECTION GRID --- */}
        {!selectedShop && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Businesses</h2>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                + Register New Shop
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myShops.map((shop) => (
                <div key={shop.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{shop.name}</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${shop.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {shop.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-gray-600 text-sm">
                      Queue Type: <span className="font-semibold">{shop.queueType}</span>
                    </p>
                    <p className="text-gray-600 text-sm">
                      People Waiting: <span className="font-semibold text-indigo-600 text-lg">{shop.queueCount}</span>
                    </p>
                  </div>

                  <button 
                    onClick={() => setSelectedShop(shop)}
                    className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold py-2 px-4 rounded-lg transition-colors border border-indigo-200"
                  >
                    Manage Dashboard
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* --- VIEW 2: INDIVIDUAL SHOP DASHBOARD --- */}
        {selectedShop && (
          <div>
            {/* Back Button & Header */}
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setSelectedShop(null)}
                className="text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1"
              >
                ← Back to Shops
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">{selectedShop.name}</h2>
                <p className="text-gray-500 text-sm">Queue Type: {selectedShop.queueType}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600">Accepting new queues?</span>
                <button className={`font-bold py-2 px-6 rounded-full transition-colors ${selectedShop.status === 'Open' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`}>
                  {selectedShop.status === 'Open' ? 'YES (OPEN)' : 'NO (PAUSED)'}
                </button>
              </div>
            </div>

            {/* Queue Management Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Active Queue List */}
              <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Live Queue ({selectedShop.queueCount} waiting)</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                        <th className="p-4 font-semibold">Ticket</th>
                        <th className="p-4 font-semibold">Name</th>
                        <th className="p-4 font-semibold">Type</th>
                        <th className="p-4 font-semibold">Waited</th>
                        <th className="p-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQueue.map((person) => (
                        <tr key={person.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-4 font-bold text-indigo-600">{person.ticket}</td>
                          <td className="p-4">
                            <p className="font-medium text-gray-800">{person.name}</p>
                            <p className="text-xs text-gray-500">Party of {person.partySize}</p>
                          </td>
                          <td className="p-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${person.type === 'VIP' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                              {person.type}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">{person.timeWaited}</td>
                          <td className="p-4 text-right flex gap-2 justify-end">
                            <button className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded font-medium text-sm transition-colors">
                              No-show
                            </button>
                            <button className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 rounded font-medium text-sm transition-colors">
                              Call Next
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Quick Stats */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Today's Stats</h3>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <span className="text-gray-600">Total Served</span>
                    <span className="text-2xl font-bold text-gray-800">48</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <span className="text-gray-600">Avg. Wait Time</span>
                    <span className="text-2xl font-bold text-gray-800">18m</span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-gray-600">No-shows</span>
                    <span className="text-2xl font-bold text-red-500">3</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}