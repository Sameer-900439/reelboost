/* ═══════════════════════════════════════════════════════════════════
   ReelBoost — Admin Panel Frontend Logic
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = '/api/admin';
  const token = sessionStorage.getItem('admin_token');

  // Route protection
  const isLoginPage = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
  const isDashboard = window.location.pathname === '/admin/dashboard';

  if (!token && isDashboard) {
    window.location.href = '/admin';
    return;
  }
  if (token && isLoginPage) {
    window.location.href = '/admin/dashboard';
    return;
  }

  // ── Login Page ──
  const loginForm = document.getElementById('adminForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmail').value;
      const pass = document.getElementById('adminPassword').value;
      const errorDiv = document.getElementById('adminError');
      const btn = document.getElementById('loginBtn');

      btn.classList.add('loading');
      errorDiv.style.display = 'none';

      try {
        const res = await fetch(`${API}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();

        if (data.success) {
          sessionStorage.setItem('admin_token', data.token);
          window.location.href = '/admin/dashboard';
        } else {
          errorDiv.textContent = data.message;
          errorDiv.style.display = 'block';
        }
      } catch (err) {
        errorDiv.textContent = 'Connection error.';
        errorDiv.style.display = 'block';
      }
      btn.classList.remove('loading');
    });
  }

  // ── Dashboard Page ──
  if (isDashboard) {
    const tableBody = document.querySelector('#usersTable tbody');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const addReelBtn = document.getElementById('addReelBtn');
    const adminReelUrl = document.getElementById('adminReelUrl');
    
    const statUsers = document.getElementById('statTotalUsers');
    const statViews = document.getElementById('statTotalViews');

    const fetchUsers = async () => {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">Loading data...</td></tr>';
      try {
        const res = await fetch(`${API}/users`, {
          headers: { 'x-admin-token': token }
        });
        const data = await res.json();

        if (data.success) {
          renderTable(data.data);
          
          statUsers.textContent = data.data.length;
          const totalViews = data.data.reduce((sum, u) => sum + (u.totalViewsReceived || 0), 0);
          statViews.textContent = totalViews;
        } else if (res.status === 401) {
          sessionStorage.removeItem('admin_token');
          window.location.href = '/admin';
        }
      } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#ef4444;">Failed to load data</td></tr>';
      }
    };

    // Helper to escape HTML for display
    const esc = (str) => {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    };

    const renderTable = (users) => {
      if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No users registered yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = users.map(u => {
        const isSystem = u.email.includes('@system.com') || u.credits > 90000;
        const typeBadge = isSystem ? '<span class="badge badge-infinite">System Reel</span>' : '<span class="badge" style="background:#334155; color:#fff;">User</span>';
        
        const displayName = u.displayName || u.email.split('@')[0];
        return `
          <tr>
            <td style="font-weight:600; color:var(--text-primary);">${esc(displayName)}</td>
            <td style="color:var(--text-muted); font-size:0.82rem;"><a href="${u.reelUrl || '#'}" target="_blank" style="color:var(--accent-2); text-decoration:none;">🔗</a> ${u.email}</td>
            <td>${typeBadge}</td>
            <td style="font-weight:700; color:var(--accent-1);">${u.credits}</td>
            <td>${u.totalViewsReceived}</td>
            <td>${u.totalWatched}</td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td style="display:flex; gap:8px;">
              ${!isSystem ? `<button class="btn-action" onclick="window.addCredits('${u._id}', '${u.email}')">+ Credits</button>` : ''}
              <button class="btn-action btn-danger" onclick="window.deleteUser('${u._id}', '${u.email}')">🗑️</button>
            </td>
          </tr>
        `;
      }).join('');
    };

    // Actions
    // ── Custom Modal Logic ──
    const creditModal = document.getElementById('creditModal');
    const modalEmail = document.getElementById('modalEmail');
    const modalAmount = document.getElementById('modalAmount');
    const modalConfirm = document.getElementById('modalConfirm');
    const modalCancel = document.getElementById('modalCancel');

    let currentAddId = null;

    window.addCredits = (id, email) => {
      currentAddId = id;
      modalEmail.textContent = email;
      modalAmount.value = '50';
      creditModal.style.display = 'flex';
    };

    modalCancel.addEventListener('click', () => {
      creditModal.style.display = 'none';
      currentAddId = null;
    });

    modalConfirm.addEventListener('click', async () => {
      const amount = modalAmount.value;
      if (!amount || isNaN(amount)) {
        alert("Please enter a valid number");
        return;
      }

      modalConfirm.classList.add('loading');
      try {
        const res = await fetch(`${API}/user/${currentAddId}/credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Success! Added ${amount} credits.`);
          fetchUsers();
          creditModal.style.display = 'none';
          currentAddId = null;
        } else {
          alert('Failed: ' + data.message);
        }
      } catch (err) { alert('Error adding credits'); }
      modalConfirm.classList.remove('loading');
    });

    window.deleteUser = async (id, email) => {
      if (!confirm(`Are you SURE you want to permanently delete ${email}?`)) return;

      try {
        const res = await fetch(`${API}/user/${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': token }
        });
        const data = await res.json();
        if (data.success) {
          fetchUsers();
        } else {
          alert('Failed: ' + data.message);
        }
      } catch (err) { alert('Error deleting user'); }
    };

    addReelBtn.addEventListener('click', async () => {
      const url = adminReelUrl.value.trim();
      if (!url) return alert('Enter a reel URL');

      addReelBtn.classList.add('loading');
      try {
        const res = await fetch(`${API}/add-reel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ reelUrl: url })
        });
        const data = await res.json();
        if (data.success) {
          alert('Infinite Credit Reel added! It is now permanently at the top of the queue.');
          adminReelUrl.value = '';
          fetchUsers();
        } else {
          alert(data.message);
        }
      } catch (err) { alert('Connection error'); }
      addReelBtn.classList.remove('loading');
    });

    refreshBtn.addEventListener('click', fetchUsers);
    logoutBtn.addEventListener('click', () => { sessionStorage.removeItem('admin_token'); window.location.href = '/admin'; });

    // Initial load
    fetchUsers();
  }

})();
