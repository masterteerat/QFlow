import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function OwnerSignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fname: '',
    lname: '',
    phone_number: '',
    email: '',
    password: ''
  });
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const response = await fetch('/api/Owner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        navigate('/owner-login');
      } else {
        setErrorMessage(data.message); // แก้ไขตรงนี้
      }
    } catch (error) {
      setErrorMessage('Could not connect to the server.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Register as an Owner</h2>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2">First Name</label>
              <input type="text" name="fname" required className="w-full border border-gray-300 p-2 rounded" value={formData.fname} onChange={handleChange} />
            </div>
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2">Last Name</label>
              <input type="text" name="lname" required className="w-full border border-gray-300 p-2 rounded" value={formData.lname} onChange={handleChange} />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Contact Phone <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input type="tel" name="phone_number" className="w-full border border-gray-300 p-2 rounded" value={formData.phone_number} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Work Email</label>
            <input type="email" name="email" required className="w-full border border-gray-300 p-2 rounded" value={formData.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" required className="w-full border border-gray-300 p-2 rounded" value={formData.password} onChange={handleChange} />
          </div>

          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded mt-4">
            Register Account
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          Already registered? <Link to="/owner-login" className="text-indigo-600 hover:underline">Owner Sign In</Link>
        </p>
      </div>
    </div>
  );
}