/* ═══════════════════════════════════════════════════════════════════
   ReelBoost — Registration (Google + Email OTP)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Already logged in?
  const savedEmail = localStorage.getItem('reelboost_email');
  if (savedEmail) { window.location.href = `/dashboard?email=${encodeURIComponent(savedEmail)}`; return; }

  const API = '/api';
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+\/?(\?.*)?$/i;

  // DOM
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const stepAdmin = document.getElementById('stepAdmin');
  const resultArea = document.getElementById('resultArea');

  // Step 1
  const emailForm = document.getElementById('emailForm');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('emailError');
  const sendOtpBtn = document.getElementById('sendOtpBtn');

  // Step 2
  const otpEmail = document.getElementById('otpEmail');
  const otpForm = document.getElementById('otpForm');
  const otpCode = document.getElementById('otpCode');
  const otpError = document.getElementById('otpError');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const resendBtn = document.getElementById('resendBtn');
  const changeEmailBtn = document.getElementById('changeEmailBtn');

  // Step 3
  const reelForm = document.getElementById('reelForm');
  const reelUrlInput = document.getElementById('reelUrl');
  const urlError = document.getElementById('urlError');
  const referralInput = document.getElementById('referralCode');
  const completeBtn = document.getElementById('completeBtn');

  // Admin Step
  const adminPassForm = document.getElementById('adminPassForm');
  const adminPassInput = document.getElementById('adminPassInput');
  const adminPassError = document.getElementById('adminPassError');
  const adminPassBtn = document.getElementById('adminPassBtn');

  // State
  let currentEmail = '';
  let googleCredential = null;
  let googleUserData = null;

  // Pre-fill referral
  const params = new URLSearchParams(window.location.search);
  if (params.get('ref') && referralInput) {
    referralInput.value = params.get('ref');
  }

  // ─── Google Sign-In ───
  window.onload = async function () {
    try {
      // Fetch Client ID from backend .env
      const confRes = await fetch(`${API}/config`);
      const confData = await confRes.json();
      const GOOGLE_CLIENT_ID = confData.data.GOOGLE_CLIENT_ID;

      if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your-client-id')) {
        console.warn('Google Client ID not configured in .env');
        return; // Don't try to load button if not configured
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      google.accounts.id.renderButton(
        document.getElementById('googleBtnContainer'),
        {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 320,
        }
      );
    } catch (e) {
      console.warn('Google Sign-In not loaded:', e);
      const wrapper = document.querySelector('.google-signin-wrapper');
      if (wrapper) wrapper.style.display = 'none';
    }
  };

  async function handleGoogleResponse(response) {
    showLoading(sendOtpBtn, true);
    try {
      const res = await fetch(`${API}/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          referralCode: referralInput ? referralInput.value.trim() : '',
        }),
      });
      const data = await res.json();

      if (data.success && data.needsReel) {
        // New Google user — needs reel URL
        googleCredential = response.credential;
        googleUserData = data.data;
        currentEmail = data.data.email;
        showStep(3);
        showResult(`✅ Signed in as ${data.data.displayName || data.data.email}. Now enter your reel!`, false);
      } else if (data.success) {
        // Existing user — go to dashboard
        localStorage.setItem('reelboost_email', data.data.email);
        showResult(data.message, false);
        setTimeout(() => { window.location.href = `/dashboard?email=${encodeURIComponent(data.data.email)}`; }, 500);
      } else {
        showResult(data.message || 'Google sign-in failed.', true);
      }
    } catch (err) {
      showResult('Connection error. Please try again.', true);
    }
    showLoading(sendOtpBtn, false);
  }

  // ─── Step 1: Send OTP ───
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      showError(emailError, 'Please enter a valid email address.');
      return;
    }

    showLoading(sendOtpBtn, true);
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.isAdmin) {
        currentEmail = email;
        showStep('admin');
        showResult('🛡️ Administrator recognized', false);
      } else if (data.success) {
        currentEmail = email;
        otpEmail.textContent = email;
        showStep(2);
        showResult(`📧 Code sent to ${email}`, false);
      } else {
        showResult(data.message || 'Could not send OTP.', true);
      }
    } catch {
      showResult('Connection error. Please try again.', true);
    }
    showLoading(sendOtpBtn, false);
  });

  // ─── Step 2: Verify OTP ───
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const code = otpCode.value.trim();
    if (!code || code.length !== 6) {
      showError(otpError, 'Please enter the 6-digit code.');
      return;
    }

    showLoading(verifyOtpBtn, true);
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, code }),
      });
      const data = await res.json();

      if (data.success) {
        // Existing user login
        localStorage.setItem('reelboost_email', data.data.email);
        showResult('✅ ' + data.message, false);
        setTimeout(() => { window.location.href = `/dashboard?email=${encodeURIComponent(data.data.email)}`; }, 500);
      } else if (data.error === 'need_reel') {
        // New user — needs reel URL
        showStep(3);
        showResult('✅ Email verified! Now enter your reel link.', false);
      } else {
        showError(otpError, data.message);
      }
    } catch {
      showResult('Connection error.', true);
    }
    showLoading(verifyOtpBtn, false);
  });

  // ─── Admin Password Flow ───
  if (adminPassForm) {
    adminPassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      const password = adminPassInput.value;
      if (!password) return showError(adminPassError, 'Password required');
      
      showLoading(adminPassBtn, true);
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, password })
        });
        const data = await res.json();
        if (data.success) {
          sessionStorage.setItem('admin_token', data.token);
          window.location.href = '/admin/dashboard';
        } else {
          showError(adminPassError, data.message);
        }
      } catch {
        showResult('Connection error.', true);
      }
      showLoading(adminPassBtn, false);
    });
  }

  // Resend OTP
  resendBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail }),
      });
      const data = await res.json();
      showResult(data.success ? '📧 New code sent!' : data.message, !data.success);
    } catch {
      showResult('Connection error.', true);
    }
  });

  // Change email
  changeEmailBtn.addEventListener('click', () => {
    showStep(1);
    otpCode.value = '';
    clearErrors();
    resultArea.innerHTML = '';
  });

  // ─── Step 3: Complete Registration ───
  reelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const reelUrl = reelUrlInput.value.trim();
    const refCode = referralInput.value.trim();

    if (!reelUrl || !IG_REGEX.test(reelUrl)) {
      showError(urlError, 'Please enter a valid Instagram Reel URL.');
      return;
    }

    showLoading(completeBtn, true);
    try {
      let res, data;

      if (googleCredential) {
        // Complete Google registration with reel URL
        res = await fetch(`${API}/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: googleCredential, reelUrl, referralCode: refCode }),
        });
      } else {
        // Complete OTP registration with reel URL
        res = await fetch(`${API}/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, code: 'VERIFIED', reelUrl, referralCode: refCode }),
        });
      }

      data = await res.json();

      if (data.success && data.data) {
        localStorage.setItem('reelboost_email', data.data.email);
        showResult('🎉 Account created! Redirecting...', false);
        setTimeout(() => { window.location.href = `/dashboard?email=${encodeURIComponent(data.data.email)}`; }, 800);
      } else {
        showResult(data.message || 'Registration failed.', true);
      }
    } catch {
      showResult('Connection error.', true);
    }
    showLoading(completeBtn, false);
  });

  // ─── Helpers ───
  function showStep(n) {
    step1.style.display = n === 1 ? '' : 'none';
    step2.style.display = n === 2 ? '' : 'none';
    step3.style.display = n === 3 ? '' : 'none';
    if (stepAdmin) stepAdmin.style.display = n === 'admin' ? '' : 'none';
  }

  function showLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  function showError(el, msg) { el.textContent = msg; el.parentElement.classList.add('error'); }
  function clearErrors() {
    document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
    document.querySelectorAll('.input-group').forEach(el => el.classList.remove('error'));
  }

  function showResult(msg, isError) {
    resultArea.innerHTML = `<div class="${isError ? 'error-msg' : 'success-msg'}">${msg}</div>`;
    setTimeout(() => { if (!isError) resultArea.innerHTML = ''; }, 5000);
  }
})();
