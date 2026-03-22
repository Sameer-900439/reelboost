/* ═══════════════════════════════════════════════════════════════════
   ReelBoost — Watch & Earn Page (with Daily Limits)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const email = localStorage.getItem('reelboost_email');
  if (!email) { window.location.href = '/'; return; }

  const API = '/api';
  const TIMER_SECONDS = 15;

  // DOM
  const creditCount      = document.getElementById('creditCount');
  const watchedCount     = document.getElementById('watchedCount');
  const dailyLimitDisplay = document.getElementById('dailyLimitDisplay');
  const stateLoading     = document.getElementById('stateLoading');
  const stateReel        = document.getElementById('stateReel');
  const stateEmpty       = document.getElementById('stateEmpty');
  const stateDailyLimit  = document.getElementById('stateDailyLimit');
  const reelOpenLink     = document.getElementById('reelOpenLink');
  const timerSection     = document.getElementById('timerSection');
  const timerProgress    = document.getElementById('timerProgress');
  const timerText        = document.getElementById('timerText');
  const confirmBtn       = document.getElementById('confirmBtn');
  const logoutBtn        = document.getElementById('logoutBtn');
  
  const likeVerification = document.getElementById('likeVerification');
  const likedCheckbox    = document.getElementById('likedCheckbox');

  let currentOwnerEmail = null;
  let timerInterval = null;

  function showState(state) {
    stateLoading.style.display    = state === 'loading'    ? '' : 'none';
    stateReel.style.display       = state === 'reel'       ? '' : 'none';
    stateEmpty.style.display      = state === 'empty'      ? '' : 'none';
    stateDailyLimit.style.display = state === 'dailyLimit' ? '' : 'none';
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API}/dashboard/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        creditCount.textContent = data.data.credits;
        watchedCount.textContent = data.data.dailyWatchCount;
        if (data.data.isPremium) {
          dailyLimitDisplay.textContent = ' (Unlimited)';
        } else {
          dailyLimitDisplay.textContent = ` / ${data.data.dailyLimit}`;
        }
      }
    } catch {}
  }

  async function loadNextReel() {
    showState('loading');
    resetTimer();

    try {
      const res = await fetch(`${API}/next-reel/${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data.success) { showState('empty'); return; }

      // Check daily limit
      if (data.dailyLimitReached) {
        showState('dailyLimit');
        return;
      }

      if (!data.data) { showState('empty'); return; }

      // Update daily counter
      if (data.watchCount !== undefined) {
        watchedCount.textContent = data.watchCount;
        if (data.dailyLimit) {
          dailyLimitDisplay.textContent = ` / ${data.dailyLimit}`;
        } else {
          dailyLimitDisplay.textContent = ' (Unlimited)';
        }
      }

      currentOwnerEmail = data.data.ownerEmail;
      reelOpenLink.href = data.data.reelUrl;
      showState('reel');
    } catch (err) {
      console.error('Load reel error:', err);
      showState('empty');
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerSection.style.display = 'none';
    if (likeVerification) likeVerification.style.display = 'none';
    if (likedCheckbox) likedCheckbox.checked = false;
    
    confirmBtn.disabled = true;
    confirmBtn.classList.remove('ready');
    confirmBtn.querySelector('.btn-text').textContent = '⏳ Watch the reel first...';
    timerText.textContent = TIMER_SECONDS;
    timerProgress.style.strokeDashoffset = '0';
  }

  function startTimer() {
    resetTimer();
    timerSection.style.display = '';
    let remaining = TIMER_SECONDS;
    const circumference = 2 * Math.PI * 42;

    timerInterval = setInterval(() => {
      remaining--;
      timerText.textContent = remaining;
      timerProgress.style.strokeDashoffset = circumference * (1 - remaining / TIMER_SECONDS);

      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerText.textContent = '✓';
        confirmBtn.disabled = false;
        confirmBtn.classList.add('ready');
        confirmBtn.querySelector('.btn-text').textContent = '✅ I Watched It — Claim Credit';
      }
    }, 1000);
  }

  reelOpenLink.addEventListener('click', () => {
    if (!timerInterval || timerSection.style.display === 'none') {
      if (likeVerification) likeVerification.style.display = 'block';
      startTimer();
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (confirmBtn.disabled || !currentOwnerEmail) return;
    
    if (likedCheckbox && !likedCheckbox.checked) {
      alert("⚠️ You must verify that you Liked the reel on Instagram before claiming your credit!");
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.querySelector('.btn-text').textContent = '⏳ Confirming...';

    try {
      const res = await fetch(`${API}/confirm-watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watcherEmail: email, ownerEmail: currentOwnerEmail }),
      });
      const data = await res.json();

      if (data.success) {
        const creditsEarned = data.data.isPremium ? 2 : 1;
        showCreditPopup(`+${creditsEarned} Credit${creditsEarned > 1 ? 's' : ''} Earned! 💎`);
        creditCount.textContent = data.data.credits;
        watchedCount.textContent = data.data.dailyWatchCount;

        if (data.data.dailyLimit) {
          dailyLimitDisplay.textContent = ` / ${data.data.dailyLimit}`;
        }

        setTimeout(() => loadNextReel(), 1000);
      } else if (data.dailyLimitReached) {
        showState('dailyLimit');
      } else {
        showCreditPopup(data.message || 'Error confirming watch', true);
        setTimeout(() => loadNextReel(), 1500);
      }
    } catch (err) {
      console.error('Confirm error:', err);
      showCreditPopup('Connection error. Try again.', true);
      confirmBtn.disabled = false;
      confirmBtn.querySelector('.btn-text').textContent = '✅ I Watched It — Claim Credit';
    }
  });

  function showCreditPopup(message, isError) {
    const popup = document.createElement('div');
    popup.className = 'credit-popup';
    if (isError) {
      popup.style.background = 'rgba(239,68,68,0.15)';
      popup.style.borderColor = 'rgba(239,68,68,0.3)';
      popup.style.color = '#fca5a5';
    }
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
  }

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('reelboost_email');
    window.location.href = '/';
  });

  loadStats();
  loadNextReel();
})();
