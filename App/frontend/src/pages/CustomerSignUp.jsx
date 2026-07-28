import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function CustomerSignUp() {
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
    
    // Ready to be sent to your future /api/customer/signup route
    console.log("Customer Registration Data:", formData);
    
    try {
      const response = await fetch('http://localhost:3000/api/Customer/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if(data.success){
        navigate('/')
      } else {
        setErrorMessage(data.errorMessage)
      }
    } catch(error){
        setErrorMessage("Could not connect to the server.")
    }
    // Placeholder for actual fetch logic
    // ...
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Join QFlow</h2>
        
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
            <label className="block text-gray-700 text-sm font-bold mb-2">Phone Number <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input type="tel" name="phone_number" className="w-full border border-gray-300 p-2 rounded" value={formData.phone_number} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input type="email" name="email" required className="w-full border border-gray-300 p-2 rounded" value={formData.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" required className="w-full border border-gray-300 p-2 rounded" value={formData.password} onChange={handleChange} />
          </div>

          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
            Create Customer Account
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          Already have an account? <Link to="/" className="text-blue-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}