const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const OTP = require('../models/OTP');
const WatchLog = require('../models/WatchLog');
const { sendOTP } = require('../services/emailService');

const INSTAGRAM_URL_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+\/?(\?.*)?$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REFERRAL_BONUS = 50; // Worth 50 views
const FREE_DAILY_LIMIT = 100;
const WATCH_REWARD = 2; // Earn 2 credits per watch
const VIEW_COST = 1;    // Cost 1 credit per view received
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ═══════════════════════════════════════════════════════════════
// POST /api/send-otp — Send verification code to email
// ═══════════════════════════════════════════════════════════════
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // ── Admin Check ──
    const adminEmail = process.env.ADMIN_EMAIL || 'sameergupta554667@gmail.com';
    if (cleanEmail === adminEmail.toLowerCase().trim()) {
      return res.json({ success: true, isAdmin: true, message: 'Admin recognized. Enter password.' });
    }

    // Rate limit: max 3 OTPs per email per hour
    const recentOTPs = await OTP.countDocuments({
      email: cleanEmail,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recentOTPs >= 3) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait and try again.' });
    }

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: cleanEmail });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OTP.create({ email: cleanEmail, code, expiresAt });
    await sendOTP(cleanEmail, code);

    console.log(`📧 OTP sent to ${cleanEmail}`);

    return res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Check your inbox!`,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Could not send OTP.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/verify-otp — Verify code and register/login user
// ═══════════════════════════════════════════════════════════════
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code, reelUrl, referralCode } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const otpRecord = await OTP.findOne({ email: cleanEmail }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ email: cleanEmail });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteMany({ email: cleanEmail });
      return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    // Verify code
    if (otpRecord.code !== code.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Invalid code. ${MAX_OTP_ATTEMPTS - otpRecord.attempts} attempts remaining.`,
      });
    }

    // OTP verified! Delete it
    await OTP.deleteMany({ email: cleanEmail });

    // Check if user exists (login) or create new (register)
    let user = await User.findOne({ email: cleanEmail });
    let isNew = false;

    if (user) {
      user.isVerified = true;
      await user.save();
    } else {
      // New user — need reel URL
      if (!reelUrl || !INSTAGRAM_URL_REGEX.test(reelUrl.trim())) {
        return res.status(400).json({ success: false, error: 'need_reel', message: 'OTP verified! Now enter your Instagram Reel URL.' });
      }

      const ipCount = await User.countDocuments({ ipAddress: ip });
      if (ipCount >= 3) {
        return res.status(429).json({ success: false, message: 'Too many accounts from this device.' });
      }

      user = new User({
        email: cleanEmail,
        reelUrl: reelUrl.trim(),
        isVerified: true,
        ipAddress: ip,
        referredBy: referralCode || null,
      });
      await user.save();
      isNew = true;

      // Referral bonus
      if (referralCode) {
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referrer) {
          referrer.credits += REFERRAL_BONUS;
          await referrer.save();
          console.log(`🎁 Referral bonus: +${REFERRAL_BONUS} credits to ${referrer.email}`);
        }
      }

      console.log(`✅ New user registered via OTP: ${user.email}`);
    }

    return res.json({
      success: true,
      isNew,
      message: isNew ? 'Account created! Start watching reels.' : 'Welcome back!',
      data: { email: user.email, referralCode: user.referralCode, credits: user.credits },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/google-login — Sign in with Google
// ═══════════════════════════════════════════════════════════════
router.post('/google-login', async (req, res) => {
  try {
    const { credential, reelUrl, referralCode } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential missing.' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Could not get email from Google.' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNew = false;

    if (user) {
      // Existing user — update Google info
      user.googleId = googleId;
      user.displayName = name || user.displayName;
      user.avatar = picture || user.avatar;
      user.isVerified = true;
      await user.save();
    } else {
      // New user — need reel URL
      if (!reelUrl || !INSTAGRAM_URL_REGEX.test(reelUrl.trim())) {
        return res.json({
          success: true,
          needsReel: true,
          message: 'Google verified! Now enter your Instagram Reel URL.',
          data: { email, displayName: name, avatar: picture },
        });
      }

      const ipCount = await User.countDocuments({ ipAddress: ip });
      if (ipCount >= 3) {
        return res.status(429).json({ success: false, message: 'Too many accounts from this device.' });
      }

      user = new User({
        email: email.toLowerCase(),
        reelUrl: reelUrl.trim(),
        isVerified: true,
        googleId,
        displayName: name,
        avatar: picture,
        ipAddress: ip,
        referredBy: referralCode || null,
      });
      await user.save();
      isNew = true;

      if (referralCode) {
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referrer) {
          referrer.credits += REFERRAL_BONUS;
          await referrer.save();
        }
      }

      console.log(`✅ New user registered via Google: ${user.email}`);
    }

    return res.json({
      success: true,
      isNew,
      message: isNew ? 'Account created! Start watching reels.' : 'Welcome back!',
      data: {
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        referralCode: user.referralCode,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(401).json({ success: false, message: 'Google sign-in failed. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dashboard/:email
// ═══════════════════════════════════════════════════════════════
router.get('/dashboard/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.checkPremiumStatus();
    user.checkDailyReset();
    await user.save();

    const referralCount = await User.countDocuments({ referredBy: user.referralCode });

    return res.json({
      success: true,
      data: {
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        reelUrl: user.reelUrl,
        credits: user.credits,
        totalViewsReceived: user.totalViewsReceived,
        totalWatched: user.totalWatched,
        hasUsedReferral: user.hasUsedReferral,
        referralCode: user.referralCode,
        referralCount,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
        dailyWatchCount: user.dailyWatchCount,
        dailyLimit: user.isPremium ? null : FREE_DAILY_LIMIT,
        isVerified: user.isVerified,
        isGoogleUser: !!user.googleId,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Could not load dashboard.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/next-reel/:email
// ═══════════════════════════════════════════════════════════════
router.get('/next-reel/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.checkDailyReset();
    user.checkPremiumStatus();
    if (!user.isPremium && user.dailyWatchCount >= FREE_DAILY_LIMIT) {
      return res.json({
        success: true, data: null, dailyLimitReached: true,
        message: `Daily limit of ${FREE_DAILY_LIMIT} free watches reached.`,
        watchCount: user.dailyWatchCount, dailyLimit: FREE_DAILY_LIMIT,
      });
    }

    const watchedLogs = await WatchLog.find({ watcherEmail: email }).select('watchedUserEmail');
    const watchedEmails = watchedLogs.map((w) => w.watchedUserEmail);

    // Only show reels from users who have enough credits to "pay" for the view
    const candidates = await User.find({
      email: { $ne: email, $nin: watchedEmails },
      isVerified: true,
      credits: { $gte: VIEW_COST }
    }).sort({ credits: -1, createdAt: 1 }).limit(10);

    if (candidates.length === 0) {
      return res.json({
        success: true, data: null,
        message: 'No more reels available. Invite friends!',
        watchCount: user.dailyWatchCount, dailyLimit: user.isPremium ? null : FREE_DAILY_LIMIT,
      });
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return res.json({
      success: true,
      data: { reelUrl: pick.reelUrl, ownerEmail: pick.email },
      watchCount: user.dailyWatchCount, dailyLimit: user.isPremium ? null : FREE_DAILY_LIMIT,
    });
  } catch (error) {
    console.error('Next reel error:', error);
    return res.status(500).json({ success: false, message: 'Could not load next reel.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/confirm-watch
// ═══════════════════════════════════════════════════════════════
router.post('/confirm-watch', async (req, res) => {
  try {
    const { watcherEmail, ownerEmail } = req.body;
    if (!watcherEmail || !ownerEmail) {
      return res.status(400).json({ success: false, message: 'Emails required.' });
    }

    const watcher = await User.findOne({ email: watcherEmail.toLowerCase().trim() });
    const owner = await User.findOne({ email: ownerEmail.toLowerCase().trim() });
    if (!watcher || !owner) return res.status(404).json({ success: false, message: 'User not found.' });
    if (watcher.email === owner.email) return res.status(400).json({ success: false, message: "Can't watch your own reel!" });

    watcher.checkDailyReset();
    watcher.checkPremiumStatus();
    if (!watcher.isPremium && watcher.dailyWatchCount >= FREE_DAILY_LIMIT) {
      return res.status(429).json({ success: false, error: 'daily_limit', dailyLimitReached: true, message: 'Daily limit reached.' });
    }

    const alreadyWatched = await WatchLog.findOne({ watcherEmail: watcher.email, watchedUserEmail: owner.email });
    if (alreadyWatched) return res.status(409).json({ success: false, message: "Already watched this reel." });

    // Check if owner still has enough credits
    if (owner.credits < VIEW_COST) {
      return res.status(400).json({ success: false, message: "This reel's owner ran out of credits!" });
    }

    await WatchLog.create({ watcherEmail: watcher.email, watchedUserEmail: owner.email, reelUrl: owner.reelUrl });

    // Watcher earns credits
    watcher.credits += WATCH_REWARD;
    watcher.totalWatched += 1;
    watcher.dailyWatchCount += 1;
    await watcher.save();

    // Owner spends credits
    owner.credits -= VIEW_COST;
    owner.totalViewsReceived += 1;
    await owner.save();

    return res.json({
      success: true,
      message: `+${WATCH_REWARD} credits earned!`,
      data: {
        credits: watcher.credits, totalWatched: watcher.totalWatched,
        dailyWatchCount: watcher.dailyWatchCount, dailyLimit: watcher.isPremium ? null : FREE_DAILY_LIMIT,
        isPremium: watcher.isPremium,
      },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Already watched." });
    console.error('Confirm watch error:', error);
    return res.status(500).json({ success: false, message: 'Could not confirm watch.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/leaderboard
// ═══════════════════════════════════════════════════════════════
router.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.find({ isVerified: true })
      .sort({ totalViewsReceived: -1 }).limit(10)
      .select('email totalViewsReceived totalWatched isPremium displayName -_id');

    const masked = topUsers.map((u, i) => ({
      rank: i + 1,
      email: u.email.substring(0, 3) + '***' + u.email.substring(u.email.indexOf('@')),
      displayName: u.displayName,
      views: u.totalViewsReceived,
      watched: u.totalWatched,
      isPremium: u.isPremium,
    }));

    return res.json({ success: true, data: masked });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load leaderboard.' });
  }
});

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/update-reel
// ═══════════════════════════════════════════════════════════════
router.post('/update-reel', async (req, res) => {
  try {
    const { email, reelUrl } = req.body;
    if (!INSTAGRAM_URL_REGEX.test(reelUrl)) {
      return res.status(400).json({ success: false, message: 'Invalid Instagram Reel URL.' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.credits < 5) {
      return res.status(400).json({ success: false, message: 'You need at least 5 credits to update your Reel link!' });
    }

    user.credits -= 5;
    user.reelUrl = reelUrl.trim();
    await user.save();
    return res.json({ success: true, message: 'Reel updated! (Cost: 5 Credits)' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error updating reel.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/apply-referral
// ═══════════════════════════════════════════════════════════════
router.post('/apply-referral', async (req, res) => {
  try {
    const { email, referralCode } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    if (user.hasUsedReferral) {
      return res.status(400).json({ success: false, message: 'You have already used a referral code!' });
    }
    if (user.referralCode === referralCode) {
      return res.status(400).json({ success: false, message: 'You cannot use your own referral code.' });
    }

    // Find referrer by their referralCode, which matches their email base
    // Wait, earlier referralCode was derived from email. Let's just find the user whose referralCode matches.
    const referrer = await User.findOne({ referralCode });
    if (!referrer) return res.status(404).json({ success: false, message: 'Invalid referral code.' });

    // Grant bonus
    referrer.credits += REFERRAL_BONUS;
    referrer.referralCount += 1;
    await referrer.save();

    user.hasUsedReferral = true;
    await user.save();

    return res.json({ success: true, message: `Referral applied! The referrer received ${REFERRAL_BONUS} credits.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error applying referral.' });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
