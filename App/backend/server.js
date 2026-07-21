const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // 1. Import CORS
const path = require('path');

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors()); // 2. Allow React to communicate with Express
app.use(express.json()); // 3. Allow Express to read the JSON body from React
app.use(express.static(path.join(__dirname, 'public')));

// 2. Catch-all route for React (Single Page Application routing)
// This ensures that if a user refreshes a page like /login, Express sends the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// --- Login Endpoint ---
app.post('/api/login', async (req, res) => {
  // Grab the data React sent us
  const { email, password } = req.body;

  try {
    // Query the database to see if this customer exists
    // We use $1 and $2 to safely inject variables and prevent SQL injection attacks
    const result = await pool.query(
      'SELECT * FROM Customer WHERE email = $1 AND password = $2',
      [email, password]
    );

    // If result.rows has at least one item, the credentials matched!
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Send a success message back to React, but never send the password back!
      res.json({ 
        success: true, 
        message: 'Login successful',
        user: { 
          id: user.customer_id, 
          fname: user.fname, 
          email: user.email 
        } 
      });
    } else {
      // 401 means "Unauthorized"
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});