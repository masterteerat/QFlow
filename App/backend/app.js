const express = require('express');
const cors = require('cors');
const path = require('path');

const customerRoutes = require('./routes/customerRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/Customer', customerRoutes);
app.use('/api/Owner', ownerRoutes);

// Catch-all route for React SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;