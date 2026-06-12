/* ==========================================
   YDMB 认证系统 v2 - auth.js
   登录/注册/会话管理 - 通过 CloudBase 云函数操作数据库
   ========================================== */

var AUTH_KEY = 'ydmb_users_v2';    // 本地用户缓存
var SESSION_KEY = 'ydmb_session';
var INVITE_CODE = 'owydmb';

/* ---- 本地用户缓存（快速访问，无需每次查云函数） ---- */
function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '[]'); }
  catch (e) { return []; }
}

function setLocalUsers(u) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(u));
}

/* ---- 会话管理 ---- */
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch (e) { return null; }
}

function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

/* ---- 状态查询 ---- */
function isLoggedIn()  { return !!getSession(); }
function isAdmin()     { var s = getSession(); return s && s.role === 'admin'; }
function getCurrUser() { return getSession(); }

/* ---- 获取所有用户（从云函数） ---- */
function fetchUsers() {
  return callCloudFunc('ydmb-auth', { action: 'getUsers' }).then(function (res) {
    if (res.code === 0) {
      setLocalUsers(res.data || []);
      return res.data;
    }
    return getLocalUsers();
  });
}

/* ---- 默认退出登录 ---- */
function doLogout() {
  setSession(null);
  if (typeof updateAuthUI === 'function') updateAuthUI();
  if (typeof onLogout === 'function') onLogout();
  showToast('已退出登录', 'info');
}

/* ---- 认证模态框 ---- */
function openAuthModal() {
  var modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  switchAuthTab('login');
  resetAuthForms();
}

function closeAuthModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function switchAuthTab(tab) {
  var loginTab = document.getElementById('auth-tab-login');
  var regTab = document.getElementById('auth-tab-register');
  var loginForm = document.getElementById('auth-form-login');
  var regForm = document.getElementById('auth-form-register');
  resetAuthForms();

  if (tab === 'login') {
    loginTab.className = 'auth-tab flex-1 py-3.5 text-sm font-semibold text-ow-orange border-b-2 border-ow-orange bg-ow-orange/5 rounded-tl-2xl transition-colors';
    regTab.className = 'auth-tab flex-1 py-3.5 text-sm font-semibold text-ow-dark-muted border-b-2 border-transparent hover:text-white/80 transition-colors';
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  } else {
    regTab.className = 'auth-tab flex-1 py-3.5 text-sm font-semibold text-ow-orange border-b-2 border-ow-orange bg-ow-orange/5 transition-colors';
    loginTab.className = 'auth-tab flex-1 py-3.5 text-sm font-semibold text-ow-dark-muted border-b-2 border-transparent hover:text-white/80 transition-colors rounded-tl-2xl';
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

function resetAuthForms() {
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('reg-username').value = '';
  document.getElementById('reg-password').value = '';
  document.getElementById('reg-invite').value = '';
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

/* ---- 登录（通过云函数） ---- */
async function handleLogin() {
  var username = document.getElementById('login-username').value.trim();
  var password = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');
  var btn = document.getElementById('login-submit-btn');

  if (!username || !password) {
    errEl.classList.remove('hidden');
    errEl.textContent = '请填写用户名和密码';
    return;
  }

  btn.disabled = true;
  btn.textContent = '登录中...';

  try {
    var res = await callCloudFunc('ydmb-auth', {
      action: 'login',
      username: username,
      password: password
    });

    if (res.code !== 0) {
      errEl.classList.remove('hidden');
      errEl.textContent = res.message || '登录失败';
      btn.disabled = false;
      btn.textContent = '登录';
      return;
    }

    var user = res.data;
    setSession({ id: user.id, username: user.username, role: user.role, avatar: user.avatar, nickname: user.nickname });
    errEl.classList.add('hidden');
    closeAuthModal();

    if (typeof updateAuthUI === 'function') updateAuthUI();
    if (typeof onLogin === 'function') onLogin(user);
    showToast('登录成功！欢迎回来，' + user.username, 'success');
  } catch (e) {
    errEl.classList.remove('hidden');
    errEl.textContent = '网络错误，请稍后重试';
    console.error(e);
  }

  btn.disabled = false;
  btn.textContent = '登录';
}

/* ---- 注册（通过云函数） ---- */
async function handleRegister() {
  var username = document.getElementById('reg-username').value.trim();
  var password = document.getElementById('reg-password').value;
  var invite = document.getElementById('reg-invite').value.trim();
  var errEl = document.getElementById('reg-error');
  var btn = document.getElementById('reg-submit-btn');

  if (!username || !password) {
    errEl.classList.remove('hidden');
    errEl.textContent = '请填写用户名和密码';
    return;
  }
  if (username.length < 2 || username.length > 20) {
    errEl.classList.remove('hidden');
    errEl.textContent = '用户名2-20个字符';
    return;
  }
  if (password.length < 4) {
    errEl.classList.remove('hidden');
    errEl.textContent = '密码至少4位';
    return;
  }
  if (invite !== INVITE_CODE) {
    errEl.classList.remove('hidden');
    errEl.textContent = '邀请码错误';
    return;
  }

  btn.disabled = true;
  btn.textContent = '注册中...';

  try {
    var res = await callCloudFunc('ydmb-auth', {
      action: 'register',
      username: username,
      password: password,
      invite: invite
    });

    if (res.code !== 0) {
      errEl.classList.remove('hidden');
      errEl.textContent = res.message || '注册失败';
      btn.disabled = false;
      btn.textContent = '注册加入战队';
      return;
    }

    var user = res.data;
    setSession({ id: user.id, username: user.username, role: user.role, avatar: user.avatar, nickname: user.nickname });
    errEl.classList.add('hidden');
    closeAuthModal();

    if (typeof updateAuthUI === 'function') updateAuthUI();
    if (typeof onRegister === 'function') onRegister(user);
    showToast(res.message || '注册成功！欢迎加入战队', 'success');
  } catch (e) {
    errEl.classList.remove('hidden');
    errEl.textContent = '网络错误，请稍后重试';
    console.error(e);
  }

  btn.disabled = false;
  btn.textContent = '注册加入战队';
}
