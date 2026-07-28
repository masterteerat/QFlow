import { useState } from "react";
import { useNavigate, Link} from "react-router-dom";

export default function CustomerLogin(){
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        const userCredential = {
            email: email,
            password: password
        };

        console.log("Sending to backend: ", userCredential);

        try{
            const response = await fetch('http://localhost:3000/api/Customer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify(userCredential)
            });

            const data = await response.json();
            
            if(data.success) {
                navigate('/customer-home')
            } else {
                setErrorMessage(data.message);
            }
        } catch (error) {
            setErrorMessage("Could not connect to the server.")
        }
    };

    return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Login to QFlow</h2>
        
        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input 
              type="email" required
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              value={email} onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input 
              type="password" required
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              value={password} onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors mt-2">
            Sign In
          </button>
        </form>

        {/* Navigation Links */}
        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p>Don't have an account? <Link to="/customer-signup" className="text-blue-600 hover:underline">Sign up</Link></p>
          <p className="text-gray-500 text-xs mt-4">Are you a shop owner? <Link to="/owner-login" className="text-blue-600 hover:underline">Owner Login</Link></p>
        </div>
      </div>
    </div>
  );
  
}