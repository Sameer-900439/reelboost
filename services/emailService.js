/**
 * Email Service — Sends OTP emails via Gmail SMTP (free)
 *
 * Setup:
 * 1. Enable 2-Step Verification on your Gmail: https://myaccount.google.com/security
 * 2. Create an App Password: https://myaccount.google.com/apppasswords
 * 3. Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000,   // 5 seconds
  socketTimeout: 5000      // 5 seconds
});

// Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Gmail SMTP connection FAILED:', error.message);
    console.error('   → Check GMAIL_USER and GMAIL_APP_PASSWORD in your env vars');
  } else {
    console.log(`✅ Gmail SMTP ready — sending from: ${process.env.GMAIL_USER}`);
  }
});

/**
 * Send OTP verification email
 * @param {string} toEmail - Recipient email
 * @param {string} code - 6-digit OTP code
 */
const sendOTP = async (toEmail, code) => {
  const mailOptions = {
    from: `"ReelBoost" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Your ReelBoost Verification Code: ${code}`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif; max-width:480px; margin:0 auto; padding:32px; background:#0a0a1a; border-radius:16px;">
        <div style="text-align:center; margin-bottom:24px;">
          <h1 style="color:#fff; font-size:24px; margin:0;">⚡ ReelBoost</h1>
          <p style="color:#a0a0c0; font-size:14px; margin-top:4px;">Free Instagram Reel Views Exchange</p>
        </div>
        <div style="background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.2); border-radius:12px; padding:24px; text-align:center;">
          <p style="color:#a0a0c0; font-size:14px; margin:0 0 12px;">Your verification code is:</p>
          <div style="font-size:36px; font-weight:800; color:#a855f7; letter-spacing:8px; margin:8px 0;">${code}</div>
          <p style="color:#6b6b8d; font-size:12px; margin-top:12px;">This code expires in <strong style="color:#a0a0c0;">5 minutes</strong></p>
        </div>
        <p style="color:#6b6b8d; font-size:12px; text-align:center; margin-top:20px;">
          If you didn't request this code, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 OTP sent to ${toEmail} | MessageID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Email send error to ${toEmail}:`, error.message);
    // Surface the real error code to help diagnose
    const reason = error.responseCode === 535
      ? 'Gmail App Password is incorrect. Please regenerate it at myaccount.google.com/apppasswords'
      : error.responseCode === 534
      ? '2-Step Verification is not enabled on the Gmail account'
      : error.message;
    throw new Error(`Failed to send OTP: ${reason}`);
  }
};

module.exports = { sendOTP };
