const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  reelUrl: {
    type: String,
    required: true,
  },
  orderId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'processing',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // TTL index: auto-delete after 24 hours (86400 seconds)
  },
});

// Indexes for fast rate-limit lookups
usageSchema.index({ email: 1, createdAt: -1 });
usageSchema.index({ ipAddress: 1, createdAt: -1 });

module.exports = mongoose.model('Usage', usageSchema);
