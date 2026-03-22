const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');

// Simple constant token for frontend session (not true JWT to keep it simple, but checked via headers)
const ADMIN_SECRET_TOKEN = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'Sameer@90043').digest('hex');

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_SECRET_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized Administration Access' });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/login
// ═══════════════════════════════════════════════════════════════
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const validEmail = process.env.ADMIN_EMAIL || 'sameergupta554667@gmail.com';
  const validPass = process.env.ADMIN_PASSWORD || 'Sameer@90043';

  if (email === validEmail && password === validPass) {
    return res.json({ success: true, token: ADMIN_SECRET_TOKEN, message: 'Admin login successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/users
// ═══════════════════════════════════════════════════════════════
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: 'Could not fetch users' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/user/:id/credit
// ═══════════════════════════════════════════════════════════════
router.post('/user/:id/credit', verifyAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount)) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.credits += Number(amount);
    await user.save();

    return res.json({ success: true, message: `Added ${amount} credits to ${user.email}`, credits: user.credits });
  } catch (error) {
    console.error('Admin add credit error:', error);
    return res.status(500).json({ success: false, message: 'Could not add credits' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/admin/user/:id
// ═══════════════════════════════════════════════════════════════
router.delete('/user/:id', verifyAdmin, async (req, res) => {
  try {
    // Note: This permanently deletes the user. For a softer approach, you could add an isBanned field.
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, message: `User ${user.email} permanently deleted.` });
  } catch (error) {
    console.error('Admin delete error:', error);
    return res.status(500).json({ success: false, message: 'Could not delete user' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/add-reel (Infinite Credits System Reel)
// ═══════════════════════════════════════════════════════════════
router.post('/add-reel', verifyAdmin, async (req, res) => {
  try {
    const { reelUrl } = req.body;
    if (!reelUrl) return res.status(400).json({ success: false, message: 'Reel URL required' });

    // Create a fake system user
    const sysCode = crypto.randomBytes(4).toString('hex');
    const systemUser = new User({
      email: `sysadmin_${sysCode}@system.com`,
      displayName: 'System Admin',
      reelUrl: reelUrl.trim(),
      isVerified: true,
      isSystemReel: true,
      credits: 9999999, // Infinite credits
      ipAddress: '127.0.0.1',
    });

    await systemUser.save();

    return res.json({ 
      success: true, 
      message: 'Infinite Credit Reel added successfully! It is now permanently at the top of the queue.',
      data: systemUser 
    });
  } catch (error) {
    console.error('Admin reel error:', error);
    return res.status(500).json({ success: false, message: 'Could not add system reel' });
  }
});

module.exports = router;
