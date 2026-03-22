/**
 * Mock SMM Panel API Service
 *
 * In production, replace the mock logic with a real HTTP POST request
 * to your SMM panel provider. The structure below mirrors real SMM APIs.
 */

// Uncomment for real API calls:
// const fetch = require('node-fetch');

const SMM_API_KEY = () => process.env.SMM_API_KEY || 'demo_key';
const SMM_API_URL = () => process.env.SMM_API_URL || 'https://example-smm-panel.com/api/v2';

/**
 * Sends an order to the SMM Panel API.
 * @param {string} reelUrl - The Instagram Reel URL to boost.
 * @param {number} quantity - Number of views to send (default: 100).
 * @returns {Promise<object>} - API response with order details.
 */
const sendViewsOrder = async (reelUrl, quantity = 100) => {
  // ─── MOCK IMPLEMENTATION ────────────────────────────────────────────
  // Simulates a 1-2 second network delay
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

  // Simulate a ~95% success rate
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log(`📦 Mock SMM order placed: ${orderId} | URL: ${reelUrl} | Views: ${quantity}`);

    return {
      success: true,
      orderId,
      quantity,
      status: 'processing',
      message: `Order placed successfully! ${quantity} views are being delivered to your reel.`,
    };
  } else {
    throw new Error('SMM Panel temporarily unavailable. Please try again later.');
  }

  // ─── REAL IMPLEMENTATION (uncomment to use) ──────────────────────────
  /*
  const response = await fetch(SMM_API_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SMM_API_KEY(),
      action: 'add',
      service: '1001',        // Service ID for Instagram Reel Views
      link: reelUrl,
      quantity: quantity,
    }),
  });

  if (!response.ok) {
    throw new Error(`SMM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    success: true,
    orderId: data.order,
    quantity,
    status: 'processing',
    message: `Order #${data.order} placed! ${quantity} views are being delivered.`,
  };
  */
};

module.exports = { sendViewsOrder };
