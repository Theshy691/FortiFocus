const ADMIN_SESSION_KEY = 'ff_admin_authenticated';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const USERS_KEY = 'ff_users';
const SESSIONS_KEY = 'ff_sessions';

const DB = {
  loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch (error) {
      return [];
    }
  },
  saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },
  loadSessions() {
    try {
      return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    } catch (error) {
      return [];
    }
  },
  saveSessions(sessions) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },
  ensureSeedData() {
    const users = this.loadUsers();
    if (users.length) {
      return;
    }
    const now = new Date().toISOString();
    this.saveUsers([
      {
        id: 1,
        username: 'demo',
        email: 'demo@fortifocus.app',
        password: 'admin',
        joined: now,
        updatedAt: now,
        lastLoginAt: null
      }
    ]);
    this.saveSessions([
      {
        id: `${Date.now()}-1`,
        username: 'demo',
        subject: 'Welcome Session',
        duration: 25,
        status: 'completed',
        planned: 25,
        date: now
      }
    ]);
  },
  deleteUser(username) {
    const users = this.loadUsers().filter((user) => user.username !== username);
    const sessions = this.loadSessions().filter((session) => session.username !== username);
    this.saveUsers(users);
    this.saveSessions(sessions);
  }
};

DB.ensureSeedData();

let pendingDeleteUser = null;
let allUsers = {};
let allSessions = {};

function showAdminError(message) {
  const userBody = document.getElementById('userTableBody');
  const sessionBody = document.getElementById('sessionLogBody');
  const refresh = document.getElementById('lastRefresh');
  if (userBody) {
    userBody.innerHTML = `<tr class="empty-row"><td colspan="9">${message}</td></tr>`;
  }
  if (sessionBody) {
    sessionBody.innerHTML = `<tr class="empty-row"><td colspan="6">${message}</td></tr>`;
  }
  if (refresh) {
    refresh.textContent = 'Data unavailable';
  }
}

function applyTheme() {
  const dark = localStorage.getItem('ff_theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
}

function toggleTheme() {
  const dark = localStorage.getItem('ff_theme') === 'dark';
  localStorage.setItem('ff_theme', dark ? 'light' : 'dark');
  applyTheme();
}

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

applyTheme();

function loadData() {
  const users = DB.loadUsers().map(({ password, ...user }) => user);
  const sessions = DB.loadSessions();
  allUsers = Object.fromEntries(users.map((user) => [user.username, user]));
  allSessions = {};
  for (const session of sessions) {
    if (!allSessions[session.username]) {
      allSessions[session.username] = [];
    }
    allSessions[session.username].push(session);
  }
  renderKPIs();
  renderTable();
  renderSessionLog();
  populateUserFilter();
  document.getElementById('lastRefresh').textContent = `Refreshed ${new Date().toLocaleTimeString()}`;
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.location.href = 'index.html';
}

function userSessions(u) { return (allSessions[u] || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)); }
function completedSessions(u) { return userSessions(u).filter((s) => s.status === 'completed'); }
function focusMinutes(u) { return completedSessions(u).reduce((a, s) => a + s.duration, 0); }
function successRate(u) {
  const total = userSessions(u).length;
  return total ? Math.round(completedSessions(u).length / total * 100) : 0;
}
function calcStreak(u) {
  const days = new Set(userSessions(u).filter((x) => x.status === 'completed').map((x) => new Date(x.date).toDateString()));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  return streak;
}
function lastActive(u) {
  const s = userSessions(u);
  if (!s.length) return null;
  return new Date(Math.max(...s.map((x) => new Date(x.date))));
}
function isActiveToday(u) {
  const la = lastActive(u);
  return la && la.toDateString() === new Date().toDateString();
}
function avatarColor(name) {
  const colors = ['#5a7a5c', '#3d6b8e', '#c17b2a', '#b85c6e', '#7a8f5a', '#8b5e52'];
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return colors[hash % colors.length];
}
function initials(name) { return name.slice(0, 2).toUpperCase(); }
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return 'Never';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderKPIs() {
  const users = Object.keys(allUsers);
  let totalSess = 0;
  let totalComp = 0;
  let totalFocus = 0;
  let activeToday = 0;
  for (const u of users) {
    totalSess += userSessions(u).length;
    totalComp += completedSessions(u).length;
    totalFocus += focusMinutes(u);
    if (isActiveToday(u)) activeToday++;
  }
  document.getElementById('kpiUsers').textContent = users.length;
  document.getElementById('kpiSessions').textContent = totalSess;
  document.getElementById('kpiCompleted').textContent = totalComp;
  document.getElementById('kpiRate').textContent = totalSess ? `${Math.round(totalComp / totalSess * 100)}% success rate` : 'no sessions yet';
  document.getElementById('kpiFocus').textContent = totalFocus;
  document.getElementById('kpiToday').textContent = activeToday;
}

function renderTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const sort = document.getElementById('sortSelect').value;
  const filter = document.getElementById('filterActive').value;
  let users = Object.values(allUsers);

  if (filter === 'active') users = users.filter((u) => isActiveToday(u.username));
  if (filter === 'inactive') users = users.filter((u) => !isActiveToday(u.username));
  if (q) users = users.filter((u) => u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));

  if (sort === 'newest') users.sort((a, b) => new Date(b.joined || 0) - new Date(a.joined || 0));
  if (sort === 'oldest') users.sort((a, b) => new Date(a.joined || 0) - new Date(b.joined || 0));
  if (sort === 'sessions_desc') users.sort((a, b) => userSessions(b.username).length - userSessions(a.username).length);
  if (sort === 'streak_desc') users.sort((a, b) => calcStreak(b.username) - calcStreak(a.username));
  if (sort === 'alpha') users.sort((a, b) => a.username.localeCompare(b.username));

  document.getElementById('userCount').textContent = `(${users.length})`;
  const tbody = document.getElementById('userTableBody');
  if (!users.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((u) => {
    const streak = calcStreak(u.username);
    const rate = successRate(u.username);
    const fm = focusMinutes(u.username);
    const la = lastActive(u.username);
    const active = isActiveToday(u.username);
    const totalS = userSessions(u.username).length;
    const col = avatarColor(u.username);
    const joined = fmtDate(u.joined);
    const email = u.email || 'No email';
    return `<tr>
      <td>
        <div class="avatar-cell">
          <div class="avatar" style="background:${col}">${initials(u.username)}</div>
          <div>
            <div class="user-name">${u.username}</div>
            <div style="font-size:.68rem;color:var(--ink-4);font-family:'DM Mono',monospace;word-break:break-word;">${email}</div>
            ${active ? '<div style="font-size:.65rem;color:var(--sage);font-family:DM Mono,monospace;">active today</div>' : ''}
          </div>
        </div>
      </td>
      <td><span class="mono">${email}</span></td>
      <td><span class="mono">${joined}</span></td>
      <td><span class="badge badge-purple">${totalS}</span></td>
      <td><span class="mono">${fm}m</span></td>
      <td><span class="${streak > 0 ? 'badge badge-amber' : 'mono'}">${streak}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span class="mono">${rate}%</span>
          <div style="width:50px;height:5px;background:var(--paper-3);border-radius:3px;overflow:hidden;">
            <div style="width:${rate}%;height:100%;background:linear-gradient(90deg,var(--sage),var(--sky));border-radius:3px;"></div>
          </div>
        </div>
      </td>
      <td><span class="mono">${la ? fmtDate(la) : 'Never'}</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-view" onclick="openUserModal('${u.username}')">View</button>
          <button class="btn btn-danger-sm" onclick="askDelete('${u.username}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateUserFilter() {
  const sel = document.getElementById('sessUserFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Users</option>';
  for (const u of Object.keys(allUsers)) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function renderSessionLog() {
  const q = document.getElementById('sessSearch').value.toLowerCase();
  const statusF = document.getElementById('sessStatusFilter').value;
  const userF = document.getElementById('sessUserFilter').value;
  let rows = [];

  for (const [u, sessList] of Object.entries(allSessions)) {
    for (const s of sessList) rows.push({ ...s, username: u });
  }

  if (userF !== 'all') rows = rows.filter((r) => r.username === userF);
  if (statusF !== 'all') rows = rows.filter((r) => r.status === statusF);
  if (q) rows = rows.filter((r) => r.username.toLowerCase().includes(q) || (r.subject || '').toLowerCase().includes(q));

  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('sessionCount').textContent = `(${rows.length})`;
  const tbody = document.getElementById('sessionLogBody');

  if (!rows.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No sessions found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const col = avatarColor(r.username);
    const isComp = r.status === 'completed';
    return `<tr>
      <td>
        <div class="avatar-cell">
          <div class="avatar" style="background:${col};width:26px;height:26px;font-size:.65rem;">${initials(r.username)}</div>
          <span style="font-weight:600;font-size:.85rem;color:var(--ink);">${r.username}</span>
        </div>
      </td>
      <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);">${r.subject || 'Untitled'}</td>
      <td><span class="mono">${fmtDateTime(r.date)}</span></td>
      <td><span class="mono">${r.planned || '-'}m</span></td>
      <td><span class="mono">${r.duration}m</span></td>
      <td><span class="badge ${isComp ? 'badge-green' : 'badge-red'}">${isComp ? 'completed' : 'interrupted'}</span></td>
    </tr>`;
  }).join('');
}

function openUserModal(username) {
  const u = allUsers[username];
  if (!u) return;

  const av = document.getElementById('modalAvatar');
  av.textContent = initials(username);
  av.style.background = avatarColor(username);
  document.getElementById('modalName').textContent = username;
  document.getElementById('modalEmail').textContent = u.email || 'No email';

  const s = userSessions(username);
  const comp = completedSessions(username);
  const streak = calcStreak(username);
  const rate = successRate(username);
  const fm = focusMinutes(username);
  const joined = fmtDate(u.joined);
  const lastLogin = fmtDateTime(u.lastLoginAt);
  const accountUpdated = fmtDateTime(u.updatedAt);

  document.getElementById('modalStats').innerHTML = `
    <div class="ms"><div class="ml">Sessions</div><div class="mv">${s.length}</div></div>
    <div class="ms"><div class="ml">Completed</div><div class="mv green">${comp.length}</div></div>
    <div class="ms"><div class="ml">Streak</div><div class="mv amber">${streak}</div></div>
    <div class="ms"><div class="ml">Focus Time</div><div class="mv cyan">${fm}m</div></div>
    <div class="ms"><div class="ml">Success %</div><div class="mv">${rate}%</div></div>
    <div class="ms"><div class="ml">Registered</div><div class="mv" style="font-size:.95rem;">${joined}</div></div>
    <div class="ms"><div class="ml">Last Login</div><div class="mv" style="font-size:.95rem;">${lastLogin}</div></div>
    <div class="ms"><div class="ml">Updated</div><div class="mv" style="font-size:.95rem;">${accountUpdated}</div></div>
  `;

  const sessEl = document.getElementById('modalSessions');
  if (!s.length) {
    sessEl.innerHTML = '<div class="sess-empty">No sessions recorded yet.</div>';
  } else {
    sessEl.innerHTML = s.map((x) => `
      <div class="sess-item">
        <div class="si-left">
          <div class="si-sub">${x.subject || 'Untitled'}</div>
          <div class="si-date">${fmtDateTime(x.date)}</div>
        </div>
        <div class="si-right">
          <span class="mono" style="font-size:.75rem;">${x.duration}m</span>
          <span class="badge ${x.status === 'completed' ? 'badge-green' : 'badge-red'}">${x.status}</span>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('userModal').classList.add('open');
}

function closeModal() {
  document.getElementById('userModal').classList.remove('open');
}

function askDelete(username) {
  pendingDeleteUser = username;
  document.getElementById('confirmMsg').textContent = `Delete "${username}" and all their local data? This cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  pendingDeleteUser = null;
}

function confirmDelete() {
  if (!pendingDeleteUser) return;
  const deletedUser = pendingDeleteUser;
  DB.deleteUser(deletedUser);
  closeConfirm();
  closeModal();
  loadData();
  showToast(`User "${deletedUser}" deleted.`, 'err');
  pendingDeleteUser = null;
}

function showToast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

document.getElementById('userModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('confirmOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeConfirm();
});

if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
  window.location.href = 'index.html';
} else {
  try {
    loadData();
  } catch (error) {
    showAdminError('Unable to load local data from this browser.');
    showToast(error.message, 'err');
  }
}
