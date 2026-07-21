import { useState } from 'react';

export default function App() {
  //Variables to hold what the user types
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  //The Submit Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Create the credential object from our state
    const userCredential = {
      email: email,
      password: password
    };

    console.log("Sending to backend:", userCredential);

    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userCredential)
      });
      
      const data = await response.json();

      if (data.success) {
        alert(`Welcome back, ${data.user.fname}!`);
      } else {
        setErrorMessage(data.message);
      }

      // Test
      // if (email === "test@qflow.com" && password === "1234") {
      //   alert("Login successful!");
      // } else {
      //   setErrorMessage("Invalid email or password.");
      // }

    } catch (error) {
      setErrorMessage("Could not connect to the server.");
    }
  };

  
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Login to QFlow</h2>
        
        {/* If there's an error, display it here */}
        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input 
              type="email" 
              required
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors mt-2"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}