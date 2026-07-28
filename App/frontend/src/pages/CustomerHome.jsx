import { Link } from 'react-router-dom';

export default function CustomerHome() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Customer Dashboard</h1>
          <Link to="/" className="text-red-500 hover:underline font-semibold">Log Out</Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Available Shops</h2>
          <p className="text-gray-600">Welcome to QFlow! Reserve your spot in line here.</p>
          {/* Queue reservation UI will go here later */}
        </div>
      </div>
    </div>
  );
}