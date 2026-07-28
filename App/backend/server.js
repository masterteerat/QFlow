const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors()); // 2. Allow React to communicate with Express
app.use(express.json()); // 3. Allow Express to read the JSON body from React
app.use(express.static(path.join(__dirname, 'public')));

//Db
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

//login Endpoint
app.post('/api/Customer/login', async (req, res) => {
  //get the data from React
  const { email, password } = req.body;

  try {
    //query the db to find user
    const result = await pool.query(
      'SELECT * FROM Customer WHERE email = $1 AND password = $2',
      [email, password]
    );

    //match credential
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      //send message to frontend
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
      //"Unauthorized"
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.post('/api/Owner/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM Owner WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length > 0) {
      const owner = result.rows[0];

      res.json({
        success: true,
        message: 'Login succesful',
        owner: {
          id: owner.owner_id,
          fname: owner.fname,
          lname: owner.lname
        }
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Database query error: ', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.post('/api/Customer/signup', async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;
  try {
    const result = await pool.query(
     'INSERT INTO Customer (fname, lname, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [fname, lname, phone_number, email, password]
    );

    res.status(201).json({
      success: true,
      message: 'Account create successfully.',
      user: {
        id: result.rows[0].customer_id,
        fname: result.rows[0].fname,
        email: result.rows[0].email
      }
    });
  } catch (error) {
    console.error('Database insert error: ', error);

    if (error.code === '23505') {
      return res.status(409).json({ 
        success: false, 
        message: 'That email is already in use.' 
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.post('/api/Owner/signup', async (req, res) => {
  const { fname, lname, phone_number, email, password } = req.body;
  try {
    const result = await pool.query(
     'INSERT INTO Owner (fname, lname, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [fname, lname, phone_number, email, password]
    );

    res.status(201).json({
      success: true,
      message: 'Account create successfully.',
      user: {
        id: result.rows[0].owner_id,
        fname: result.rows[0].fname,
        email: result.rows[0].email
      }
    });
  } catch (error) {
    console.error('Database insert error: ', error);

    if (error.code === '23505') {
      return res.status(409).json({ 
        success: false, 
        message: 'That email is already in use.' 
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 2. Catch-all route for React (Single Page Application routing)
// This ensures that if a user refreshes a page like /login, Express sends the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


//Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});