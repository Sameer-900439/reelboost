const mongoose = require('mongoose');

const watchLogSchema = new mongoose.Schema({
  watcherEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  watchedUserEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  reelUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to prevent duplicate watches
watchLogSchema.index({ watcherEmail: 1, watchedUserEmail: 1 }, { unique: true });

module.exports = mongoose.model('WatchLog', watchLogSchema);
