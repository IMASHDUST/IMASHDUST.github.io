/* ==========================================
   YDMB 认证系统 - auth.js
   登录/注册/会话管理 - 所有页面共用
   需要各页面自行定义 updateAuthUI() 和 doLogout()
   ========================================== */

var AUTH_KEY = 'ydmb_users';
var SESSION_KEY = 'ydmb_session';
var INVITE_CODE = 'owydmb';

/* ---- 密码哈希 (SHA-256) ---- */
async function hashPwd(pwd) {
  var enc = new TextEncoder();
  var data = enc.encode(pwd + 'ydmb_salt');
  var hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(function (b) { return b.toString(16).padStart(2, '0'); })
    .join('');
}

/* ---- 用户数据操作 ---- */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveUsersArr(u) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(u));
}

// 向后兼容别名
function saveUsers(u) { saveUsersArr(u); }

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

/* ---- 默认退出登录（可被页面覆盖） ---- */
function doLogout() {
  setSession(null);
  if (typeof updateAuthUI === 'function') updateAuthUI();
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

/* ---- 登录 ---- */
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

  var users = getUsers();
  var user = users.find(function (u) { return u.username === username; });

  if (!user) {
    errEl.classList.remove('hidden');
    errEl.textContent = '用户名不存在';
    btn.disabled = false;
    btn.textContent = '登录';
    return;
  }

  var hash = await hashPwd(password);

  // 兼容旧数据的 password 字段和新数据的 passwordHash 字段
  var storedHash = user.passwordHash || user.password;
  if (hash !== storedHash) {
    errEl.classList.remove('hidden');
    errEl.textContent = '密码错误';
    btn.disabled = false;
    btn.textContent = '登录';
    return;
  }

  setSession({ id: user.id, username: user.username, role: user.role });
  errEl.classList.add('hidden');
  closeAuthModal();

  if (typeof updateAuthUI === 'function') updateAuthUI();
  showToast('登录成功！欢迎回来，' + user.username, 'success');

  btn.disabled = false;
  btn.textContent = '登录';
}

/* ---- 注册 ---- */
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

  var users = getUsers();
  if (users.find(function (u) { return u.username === username; })) {
    errEl.classList.remove('hidden');
    errEl.textContent = '用户名已存在';
    btn.disabled = false;
    btn.textContent = '注册加入战队';
    return;
  }

  var hash = await hashPwd(password);
  var isFirst = users.length === 0;
  var newUser = {
    id: 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
    username: username,
    passwordHash: hash,
    role: isFirst ? 'admin' : 'member',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsersArr(users);
  setSession({ id: newUser.id, username: newUser.username, role: newUser.role });

  errEl.classList.add('hidden');
  closeAuthModal();

  if (typeof updateAuthUI === 'function') updateAuthUI();
  showToast('注册成功！欢迎加入战队' + (isFirst ? '（你已成为管理员）' : ''), 'success');

  btn.disabled = false;
  btn.textContent = '注册加入战队';
}
