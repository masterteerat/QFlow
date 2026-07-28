const express = require('express');
const cors = require('cors');
const path = require('path');

const customerRoutes = require('./routes/customerRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/customer', customerRoutes);
app.use('/api/owner', ownerRoutes);

// React Router handles everything else client-side
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
