/* ═══════════════════════════════════════════════════════════════════
   ReelBoost — Dashboard Page
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const email = localStorage.getItem('reelboost_email');
  if (!email) { window.location.href = '/'; return; }

  const API = '/api';

  const userEmailEl    = document.getElementById('userEmail');
  const userAvatar     = document.getElementById('userAvatar');
  const verifiedBadge  = document.getElementById('verifiedBadge');
  const statCredits    = document.getElementById('statCredits');
  const statViews      = document.getElementById('statViews');
  const statWatched    = document.getElementById('statWatched');
  const statReferrals  = document.getElementById('statReferrals');
  const referralCode   = document.getElementById('referralCode');
  const referralInput  = document.getElementById('referralLinkInput');
  const copyBtn        = document.getElementById('copyBtn');
  const copyText       = document.getElementById('copyText');
  const leaderboardEl  = document.getElementById('leaderboard');
  const logoutBtn      = document.getElementById('logoutBtn');
  const dailyCount     = document.getElementById('dailyCount');
  const dailyLimit     = document.getElementById('dailyLimit');
  const dailyLimitBar  = document.getElementById('dailyLimitBar');

  // New additions
  const reelInput = document.getElementById('reelInput');
  const costInput = document.getElementById('costInput');
  const updateReelBtn = document.getElementById('updateReelBtn');
  const applyReferralBox = document.getElementById('applyReferralBox');
  const applyReferralInput = document.getElementById('applyReferralInput');
  const applyReferralBtn = document.getElementById('applyReferralBtn');

  async function loadDashboard() {
    try {
      const res = await fetch(`${API}/dashboard/${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        localStorage.removeItem('reelboost_email');
        window.location.href = '/';
        return;
      }

      const d = data.data;
      userEmailEl.textContent = d.displayName || d.email;

      // Avatar (Google users)
      if (d.avatar) {
        userAvatar.src = d.avatar;
        userAvatar.style.display = '';
      }

      // Verified badge
      if (d.isVerified) {
        verifiedBadge.style.display = '';
      }

      // Daily limit
      if (d.dailyLimit) {
        dailyCount.textContent = d.dailyWatchCount;
        dailyLimit.textContent = d.dailyLimit;
      } else {
        dailyLimitBar.style.display = 'none';
      }

      // Reel 
      if (reelInput) {
        reelInput.value = d.reelUrl || '';
      }
      if (costInput) {
        costInput.value = d.costPerView || 1;
      }

      // Referral 
      referralCode.textContent = d.referralCode;

      const refUrl = `${window.location.origin}/?ref=${d.referralCode}`;
      referralInput.value = refUrl;

      animateValue(statCredits, d.credits);
      animateValue(statViews, d.totalViewsReceived);
      animateValue(statWatched, d.totalWatched);
      animateValue(statReferrals, d.referralCount);

      // Hide apply referral box if already used
      if (applyReferralBox) {
        if (d.hasUsedReferral) {
          applyReferralBox.style.display = 'none';
        } else {
          applyReferralBox.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  function animateValue(el, target) {
    const duration = 800;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    if (target > 0) requestAnimationFrame(tick);
    else el.textContent = '0';
  }

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(referralInput.value);
      copyText.textContent = '✅ Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyText.textContent = '📋 Copy'; copyBtn.classList.remove('copied'); }, 2000);
    } catch {
      referralInput.select();
      document.execCommand('copy');
      copyText.textContent = '✅ Copied!';
      setTimeout(() => { copyText.textContent = '📋 Copy'; }, 2000);
    }
  });

  async function loadLeaderboard() {
    try {
      const res = await fetch(`${API}/leaderboard`);
      const data = await res.json();

      if (!data.success || !data.data.length) {
        leaderboardEl.innerHTML = '<div class="loading-text">No entries yet. Be the first!</div>';
        return;
      }

      leaderboardEl.innerHTML = data.data.map((u) => {
        let rankClass = '';
        if (u.rank === 1) rankClass = 'gold';
        else if (u.rank === 2) rankClass = 'silver';
        else if (u.rank === 3) rankClass = 'bronze';

        return `
          <div class="lb-row">
            <div class="lb-rank ${rankClass}">${u.rank}</div>
            <div class="lb-email">${esc(u.displayName || u.email)}</div>
            <div class="lb-views">${u.views} views</div>
          </div>
        `;
      }).join('');
    } catch {
      leaderboardEl.innerHTML = '<div class="loading-text">Could not load leaderboard.</div>';
    }
  }

  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('reelboost_email');
    window.location.href = '/';
  });

  // ── Make API Calls ──
  if (updateReelBtn) {
    updateReelBtn.addEventListener('click', async () => {
      const reelUrl = reelInput.value.trim();
      const costPerView = costInput ? parseInt(costInput.value, 10) : 1;
      
      if (!reelUrl) return alert('Enter a valid URL');
      if (isNaN(costPerView) || costPerView < 1) return alert('Cost per view must be at least 1 credit.');

      updateReelBtn.classList.add('loading');
      try {
        const res = await fetch(`${API}/update-reel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, reelUrl, costPerView })
        });
        const data = await res.json();
        alert(data.message);
      } catch (err) {
        alert('Connection error');
      }
      updateReelBtn.classList.remove('loading');
    });
  }

  if (applyReferralBtn) {
    applyReferralBtn.addEventListener('click', async () => {
      const referralCode = applyReferralInput.value.trim().toUpperCase();
      if (!referralCode) return alert('Enter a referral code');
      applyReferralBtn.classList.add('loading');
      try {
        const res = await fetch(`${API}/apply-referral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, referralCode })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
          applyReferralBox.style.display = 'none';
        }
      } catch (err) {
        alert('Connection error');
      }
      applyReferralBtn.classList.remove('loading');
    });
  }

  loadDashboard();
  loadLeaderboard();
})();
