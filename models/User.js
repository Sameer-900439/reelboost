const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  reelUrl: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  googleId: {
    type: String,
    default: null,
  },
  displayName: {
    type: String,
    default: null,
  },
  avatar: {
    type: String,
    default: null,
  },
  credits: {
    type: Number,
    default: 0,
    min: 0,
  },
  costPerView: {
    type: Number,
    default: 1,
    min: 1,
  },
  referralCount: {
    type: Number,
    default: 0,
  },
  hasUsedReferral: {
    type: Boolean,
    default: false,
  },
  totalViewsReceived: {
    type: Number,
    default: 0,
  },
  totalWatched: {
    type: Number,
    default: 0,
  },
  referralCode: {
    type: String,
    unique: true,
  },
  referredBy: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  isSystemReel: {
    type: Boolean,
    default: false,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumExpiry: {
    type: Date,
    default: null,
  },
  dailyWatchCount: {
    type: Number,
    default: 0,
  },
  lastWatchReset: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', function (next) {
  if (!this.referralCode) {
    this.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

userSchema.methods.checkDailyReset = function () {
  const now = new Date();
  const last = new Date(this.lastWatchReset);
  if (now.getDate() !== last.getDate() || now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
    this.dailyWatchCount = 0;
    this.lastWatchReset = now;
  }
};

userSchema.methods.checkPremiumStatus = function () {
  if (this.isPremium && this.premiumExpiry && new Date() > this.premiumExpiry) {
    this.isPremium = false;
    this.premiumExpiry = null;
  }
};

userSchema.index({ credits: -1 });
userSchema.index({ totalViewsReceived: -1 });
userSchema.index({ isPremium: 1 });

module.exports = mongoose.model('User', userSchema);
