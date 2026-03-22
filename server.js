require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin'); // Added admin routes

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS Configuration ──
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*'
    ? '*'
    : process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
};
app.use(cors(corsOptions));

// ── Body Parsing ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Trust proxy (for correct IP behind Render/Railway) ──
app.set('trust proxy', 1);

// ── Serve Static Frontend ──
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// ── Page Routes ──
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// ── Catch-all: serve index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'server_error',
    message: 'An unexpected error occurred.',
  });
});

// ── Start Server ──
const startServer = async () => {
  await connectDB();

  // ── One-time migration: rebuild WatchLog indexes for 24h TTL rotation ──
  try {
    const mongoose = require('mongoose');
    const WatchLog = require('./models/WatchLog');
    const collection = mongoose.connection.collection('watchlogs');
    
    // Drop all old indexes and let Mongoose recreate with TTL
    await collection.dropIndexes();
    await WatchLog.syncIndexes();
    console.log('✅ WatchLog indexes synced (24h TTL rotation active)');
  } catch (err) {
    // Collection might not exist yet on fresh installs — that's fine
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('⚠️ WatchLog index sync warning:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Frontend: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`👁️ Watch & Earn: http://localhost:${PORT}/watch`);
    console.log(`🔗 API base: http://localhost:${PORT}/api\n`);
  });
};

startServer();
