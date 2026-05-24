
// ════════════════════════════════════════════
// CONFIG — change this to your backend URL
// ════════════════════════════════════════════
const API = 'https://kenyasurveysback.onrender.com/api';

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let token = localStorage.getItem('ks_token') || null;
let userProfile = null;
let currentPage = 0;
let totalPages = 7;
let stats = { balance: 0, totalEarned: 0, completedQuestions: 0, totalQuestions: 40, activated: false, transactions: [] };
let activationRef = null;
let activationPollTimer = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  if (token) {
    loadUser();
  }
});

async function loadUser() {
  try {
    const data = await apiFetch('/auth/profile');
    userProfile = data;
    if (!data.profileComplete) {
      showScreen('profile-screen');
    } else {
      showScreen('app-screen');
      initApp();
    }
  } catch {
    token = null;
    localStorage.removeItem('ks_token');
    showScreen('auth-screen');
  }
}

function initApp() {
  updateSidebarUser();
  loadStats();
  loadQuestions(currentPage);
}

// ════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showPanel(name) {
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  closeSidebar();
  if (name === 'survey') loadQuestions(currentPage);
  if (name === 'withdraw') updateWithdrawPanel();
  if (name === 'transactions') renderAllTransactions();
}

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════
function switchTab(tab) {
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
}

async function doRegister() {
  const phone = document.getElementById('reg-phone').value.trim();
  const pin = document.getElementById('reg-pin').value.trim();
  const pin2 = document.getElementById('reg-pin2').value.trim();
  const errEl = document.getElementById('reg-error');
  const btn = document.getElementById('btn-register');

  clearAlert(errEl);
  if (!phone || !pin || !pin2) { showAlert(errEl, 'All fields are required.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const data = await apiFetch('/auth/register', 'POST', { phone, pin, pin2 });
    token = data.token;
    localStorage.setItem('ks_token', token);
    toast('Account created! KSh 50 welcome bonus added.', 'success');
    const user = await apiFetch('/auth/profile');
    userProfile = user;
    showScreen('profile-screen');
  } catch (err) {
    showAlert(errEl, err.message || 'Registration failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
  }
}

async function doLogin() {
  const phone = document.getElementById('login-phone').value.trim();
  const pin = document.getElementById('login-pin').value.trim();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  clearAlert(errEl);
  if (!phone || !pin) { showAlert(errEl, 'Phone and PIN required.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const data = await apiFetch('/auth/login', 'POST', { phone, pin });
    token = data.token;
    localStorage.setItem('ks_token', token);
    const user = await apiFetch('/auth/profile');
    userProfile = user;
    if (!user.profileComplete) {
      showScreen('profile-screen');
    } else {
      showScreen('app-screen');
      initApp();
    }
  } catch (err) {
    showAlert(errEl, err.message || 'Login failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
}

async function doCompleteProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const county = document.getElementById('prof-county').value;
  const occupation = document.getElementById('prof-occupation').value;
  const education = document.getElementById('prof-education').value;
  const errEl = document.getElementById('prof-error');
  const succEl = document.getElementById('prof-success');
  const btn = document.getElementById('btn-profile');

  clearAlert(errEl); clearAlert(succEl);
  if (!name || !county || !occupation || !education) { showAlert(errEl, 'All fields are required.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    await apiFetch('/auth/profile/complete', 'POST', { name, county, occupation, education });
    showAlert(succEl, 'Profile saved! Redirecting to dashboard...');
    const user = await apiFetch('/auth/profile');
    userProfile = user;
    setTimeout(() => {
      showScreen('app-screen');
      initApp();
    }, 1200);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to save profile.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Save Profile and Continue';
  }
}

function doLogout() {
  token = null;
  userProfile = null;
  localStorage.removeItem('ks_token');
  showScreen('auth-screen');
  switchTab('login');
}

// ════════════════════════════════════════════
// STATS & DASHBOARD
// ════════════════════════════════════════════
async function loadStats() {
  try {
    stats = await apiFetch('/survey/stats');
    updateDashboard();
    updateWithdrawPanel();
  } catch {}
}

function updateDashboard() {
  const bal = stats.balance.toFixed(2);
  const earned = (stats.totalEarned || 0).toFixed(2);
  const completed = stats.completedQuestions || 0;
  const total = stats.totalQuestions || 40;
  const remaining = total - completed;
  const pct = Math.round((completed / total) * 100);

  document.getElementById('sidebar-balance').textContent = `KSh ${bal}`;
  document.getElementById('sidebar-earned').textContent = `Total earned: KSh ${earned}`;
  document.getElementById('mobile-balance').textContent = `KSh ${bal}`;
  document.getElementById('stat-balance').textContent = bal;
  document.getElementById('stat-earned').textContent = earned;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-remaining').textContent = remaining;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${completed} / ${total} completed`;
  document.getElementById('nav-survey-badge').textContent = remaining;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greet}, ${userProfile?.name || 'there'}!`;

  const banner = document.getElementById('activation-banner');
  if (stats.activated) banner.classList.add('hidden');
  else banner.classList.remove('hidden');

  renderDashTransactions();
}

function updateSidebarUser() {
  if (!userProfile) return;
  document.getElementById('sidebar-name').textContent = userProfile.name || 'User';
  const ph = userProfile.phone || '';
  document.getElementById('sidebar-phone').textContent = '+' + ph;
}

function renderDashTransactions() {
  const el = document.getElementById('dash-tx-list');
  const txs = (stats.transactions || []).slice(0, 6);
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No transactions yet.</p></div>';
    return;
  }
  el.innerHTML = txs.map(tx => renderTxItem(tx)).join('');
}

function renderAllTransactions() {
  const el = document.getElementById('all-tx-list');
  const txs = stats.transactions || [];
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No transactions yet.</p></div>';
    return;
  }
  el.innerHTML = txs.map(tx => renderTxItem(tx)).join('');
}

function renderTxItem(tx) {
  const isPositive = tx.amount > 0;
  const type = tx.type;
  let iconClass = 'earn', iconName = 'coins';
  if (type === 'withdrawal') { iconClass = 'withdraw'; iconName = 'paper-plane'; }
  else if (type === 'welcome_bonus' || type === 'activation') { iconClass = 'bonus'; iconName = 'gift'; }

  const date = new Date(tx.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const amount = isPositive ? `+KSh ${tx.amount.toFixed(2)}` : `-KSh ${Math.abs(tx.amount).toFixed(2)}`;

  return `<div class="tx-item">
    <div class="tx-icon ${iconClass}"><i class="fas fa-${iconName}"></i></div>
    <div>
      <div class="tx-desc">${tx.description}</div>
      <div class="tx-date">${date}</div>
    </div>
    <div class="tx-amount ${isPositive ? 'positive' : 'negative'}">${amount}</div>
  </div>`;
}

// ════════════════════════════════════════════
// SURVEY
// ════════════════════════════════════════════
async function loadQuestions(page) {
  const grid = document.getElementById('questions-grid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const data = await apiFetch(`/survey/questions?page=${page}`);
    totalPages = data.totalPages;
    currentPage = data.page;
    renderQuestions(data.questions);
    updatePagination();
    renderPageDots(data.totalPages);
  } catch {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load questions.</p></div>';
  }
}

function renderQuestions(questions) {
  const grid = document.getElementById('questions-grid');
  const completedIds = userProfile?.completedQuestions || stats?.completedQuestions || [];

  grid.innerHTML = questions.map(q => {
    const isAnswered = (stats.completedQuestions > 0);
    return `<div class="question-card" id="qcard-${q.id}" data-answered="false">
      <div class="question-meta">
        <span class="question-cat">${q.category}</span>
        <span class="question-reward"><i class="fas fa-coins"></i> KSh ${q.reward}</span>
      </div>
      <div class="question-text">${q.question}</div>
      <div class="options-grid">
        ${q.options.map((opt, i) => `
          <button class="option-btn" id="opt-${q.id}-${i}" onclick="submitAnswer(${q.id}, ${i}, ${q.reward})">${opt}</button>
        `).join('')}
      </div>
      <div class="question-result" id="result-${q.id}"></div>
    </div>`;
  }).join('');
}

async function submitAnswer(questionId, answerIndex, reward) {
  const card = document.getElementById('qcard-' + questionId);
  if (card.dataset.answered === 'true') return;

  // Disable all options
  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`opt-${questionId}-${i}`);
    if (btn) btn.disabled = true;
  }

  const selectedBtn = document.getElementById(`opt-${questionId}-${answerIndex}`);
  if (selectedBtn) selectedBtn.style.opacity = '0.7';

  try {
    const data = await apiFetch('/survey/answer', 'POST', { questionId, answer: answerIndex });

    if (data.alreadyAnswered) {
      toast('You already answered this question.', 'info');
      card.dataset.answered = 'true';
      return;
    }

    // Update visuals
    const correctBtn = document.getElementById(`opt-${questionId}-${data.correctIndex}`);
    if (correctBtn) correctBtn.classList.add('reveal-correct');

    const resultEl = document.getElementById('result-' + questionId);

    if (data.correct) {
      selectedBtn.classList.add('selected-correct');
      card.classList.add('correct');
      resultEl.className = 'question-result correct';
      resultEl.innerHTML = `<i class="fas fa-check-circle"></i> Correct! You earned KSh ${data.earned}`;
      showEarnPop(data.earned);
      toast(`Correct! +KSh ${data.earned} added to your balance.`, 'success');
    } else {
      selectedBtn.classList.add('selected-wrong');
      card.classList.add('wrong');
      resultEl.className = 'question-result wrong';
      resultEl.innerHTML = `<i class="fas fa-times-circle"></i> Wrong. ${data.explanation || ''}`;
      toast('Wrong answer. Keep trying!', 'error');
    }

    card.dataset.answered = 'true';

    // Update balance
    stats.balance = data.balance;
    if (data.correct) {
      stats.totalEarned = (stats.totalEarned || 0) + data.earned;
      stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    } else {
      stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    }

    document.getElementById('sidebar-balance').textContent = `KSh ${data.balance.toFixed(2)}`;
    document.getElementById('mobile-balance').textContent = `KSh ${data.balance.toFixed(2)}`;
    document.getElementById('stat-balance').textContent = data.balance.toFixed(2);
    document.getElementById('wd-balance').textContent = `KSh ${data.balance.toFixed(2)}`;

    // Reload stats silently
    loadStats();

  } catch (err) {
    toast(err.message || 'Failed to submit answer.', 'error');
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`opt-${questionId}-${i}`);
      if (btn) btn.disabled = false;
    }
  }
}

function changePage(dir) {
  const newPage = currentPage + dir;
  if (newPage < 0 || newPage >= totalPages) return;
  currentPage = newPage;
  loadQuestions(currentPage);
  window.scrollTo(0, 0);
}

function updatePagination() {
  document.getElementById('btn-prev').disabled = currentPage === 0;
  document.getElementById('btn-next').disabled = currentPage >= totalPages - 1;
  document.getElementById('page-info').textContent = `Page ${currentPage + 1} of ${totalPages}`;

  if (currentPage >= totalPages - 1) {
    document.getElementById('btn-next').innerHTML = '<i class="fas fa-flag-checkered"></i> Finish';
  } else {
    document.getElementById('btn-next').innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
  }
}

function renderPageDots(total) {
  const container = document.getElementById('page-dots');
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'page-dot' + (i === currentPage ? ' current' : '');
    dot.onclick = () => { currentPage = i; loadQuestions(i); };
    container.appendChild(dot);
  }
}

// ════════════════════════════════════════════
// WITHDRAW
// ════════════════════════════════════════════
function updateWithdrawPanel() {
  const bal = (stats.balance || 0).toFixed(2);
  document.getElementById('wd-balance').textContent = `KSh ${bal}`;

  const statusEl = document.getElementById('wd-status');
  const lockedDiv = document.getElementById('wd-locked');
  const unlockedDiv = document.getElementById('wd-unlocked');

  if (stats.activated) {
    statusEl.innerHTML = '<span class="chip"><i class="fas fa-check"></i> Activated</span>';
    lockedDiv.classList.add('hidden');
    unlockedDiv.classList.remove('hidden');

    const slider = document.getElementById('wd-slider');
    const maxWithdraw = Math.min(Math.floor(stats.balance / 10) * 10, 10000);
    slider.max = Math.max(150, maxWithdraw);
    updateSlider();
  } else {
    statusEl.innerHTML = '<span class="chip gold"><i class="fas fa-lock"></i> Not Activated</span>';
    lockedDiv.classList.remove('hidden');
    unlockedDiv.classList.add('hidden');
  }
}

function updateSlider() {
  const val = document.getElementById('wd-slider').value;
  document.getElementById('wd-amount-display').textContent = val;
}

async function doActivate() {
  const phone = document.getElementById('act-phone').value.trim();
  const errEl = document.getElementById('act-error');
  const succEl = document.getElementById('act-success');
  const btn = document.getElementById('btn-activate');

  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa phone number.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending prompt...';

  try {
    const data = await apiFetch('/activation/initiate', 'POST', { phone });
    activationRef = data.reference;
    showAlert(succEl, 'M-Pesa STK prompt sent! Enter your PIN on your phone.');
    toast('Check your phone for the M-Pesa prompt.', 'info');
    startActivationPoll(activationRef);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to initiate payment.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-unlock" style="margin-right:8px"></i>Activate Account – KSh 150';
  }
}

function startActivationPoll(ref) {
  if (activationPollTimer) clearInterval(activationPollTimer);
  let attempts = 0;
  const btn = document.getElementById('btn-activate');

  activationPollTimer = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      clearInterval(activationPollTimer);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-unlock" style="margin-right:8px"></i>Activate Account – KSh 150';
      return;
    }

    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(activationPollTimer);
        stats.activated = true;
        updateWithdrawPanel();
        updateDashboard();
        toast('Account activated! You can now withdraw your earnings.', 'success');
        btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(activationPollTimer);
        showAlert(document.getElementById('act-error'), 'Payment failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-unlock" style="margin-right:8px"></i>Activate Account – KSh 150';
      }
    } catch {}
  }, 3000);
}

async function doWithdraw() {
  const phone = document.getElementById('wd-phone').value.trim();
  const amount = document.getElementById('wd-slider').value;
  const errEl = document.getElementById('wd-error');
  const succEl = document.getElementById('wd-success');
  const btn = document.getElementById('btn-withdraw');

  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa number.'); return; }
  if (parseFloat(amount) > stats.balance) { showAlert(errEl, 'Insufficient balance.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const data = await apiFetch('/survey/withdraw', 'POST', { amount: parseFloat(amount), mpesaPhone: phone });
    stats.balance = data.balance;
    updateDashboard();
    updateWithdrawPanel();
    showAlert(succEl, data.message);
    toast('Withdrawal request submitted successfully!', 'success');
    document.getElementById('wd-phone').value = '';
    loadStats();
  } catch (err) {
    showAlert(errEl, err.message || 'Withdrawal failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Request Withdrawal';
  }
}

// ════════════════════════════════════════════
// SIDEBAR MOBILE
// ════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function showAlert(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
}

function clearAlert(el) {
  el.textContent = '';
  el.classList.remove('show');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
  el.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function showEarnPop(amount) {
  const pop = document.getElementById('earn-pop');
  document.getElementById('earn-amount').textContent = `+KSh ${amount}`;
  pop.classList.add('show');
  setTimeout(() => pop.classList.remove('show'), 1800);
}
