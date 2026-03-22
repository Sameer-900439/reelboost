const Usage = require('../models/Usage');

/**
 * Rate limiter middleware.
 * Checks if the given email or IP has already used the service in the last 24 hours.
 * If so, responds with 429 Too Many Requests and includes the wait time.
 */
const checkRateLimit = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check for existing usage by email OR IP in the last 24 hours
    const existingUsage = await Usage.findOne({
      $or: [
        { email: email.toLowerCase().trim(), createdAt: { $gte: twentyFourHoursAgo } },
        { ipAddress: ip, createdAt: { $gte: twentyFourHoursAgo } },
      ],
    }).sort({ createdAt: -1 });

    if (existingUsage) {
      const resetTime = new Date(existingUsage.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const waitMs = resetTime - Date.now();
      const waitHours = Math.ceil(waitMs / (1000 * 60 * 60));
      const waitMinutes = Math.ceil(waitMs / (1000 * 60));

      return res.status(429).json({
        success: false,
        error: 'rate_limited',
        message: `You've already used this service recently. Please try again in ${waitHours > 1 ? waitHours + ' hours' : waitMinutes + ' minutes'}.`,
        retryAfter: resetTime.toISOString(),
      });
    }

    // Attach cleaned data to request for downstream use
    req.clientIp = ip;
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(error);
  }
};

module.exports = checkRateLimit;
