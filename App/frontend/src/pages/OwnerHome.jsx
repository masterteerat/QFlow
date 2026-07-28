import { Link } from 'react-router-dom';

export default function OwnerHome() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Shop Management</h1>
          <Link to="/owner-login" className="text-red-500 hover:underline font-semibold">Log Out</Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Active Queue</h2>
          <p className="text-gray-600">Welcome to your QFlow dashboard. Manage your shop queues here.</p>
        </div>
      </div>
    </div>
  );
}