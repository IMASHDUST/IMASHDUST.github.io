/* ==========================================
   YDMB 成员账号认证云函数 - ydmb-auth
   处理注册、登录、用户列表、个人信息更新
   所有数据库操作通过此云函数完成
   ========================================== */

const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const app = cloudbase.init({
  env: 'owydmb-d3ga2ncop11b11016'
});

const db = app.database();
const _ = db.command;

const INVITE_CODE = 'owydmb';
const COLLECTION = 'ydmb_users';

/* ---- 密码哈希 ---- */
function hashPwd(pwd) {
  return crypto.createHash('sha256')
    .update(pwd + 'ydmb_salt')
    .digest('hex');
}

/* ---- 生成唯一ID ---- */
function generateId() {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/* ---- 返回用户安全数据（不泄露密码哈希） ---- */
function safeUser(user) {
  if (!user) return null;
  return {
    id: user._id || user.id,
    username: user.username,
    role: user.role,
    avatar: user.avatar || '',
    nickname: user.nickname || '',
    createdAt: user.createdAt
  };
}

/* ---- 主入口 ---- */
exports.main = async (event, context) => {
  const { action } = event || {};

  try {
    switch (action) {
      case 'register':
        return await handleRegister(event);
      case 'login':
        return await handleLogin(event);
      case 'getUsers':
        return await handleGetUsers(event);
      case 'updateProfile':
        return await handleUpdateProfile(event);
      case 'changePassword':
        return await handleChangePassword(event);
      case 'checkUsername':
        return await handleCheckUsername(event);
      case 'setRole':
        return await handleSetRole(event);
      default:
        return { code: -1, message: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('云函数异常:', err);
    return { code: -1, message: '服务器内部错误: ' + err.message };
  }
};

/* ---- 注册 ---- */
async function handleRegister(event) {
  const { username, password, invite } = event;

  if (!username || !password) {
    return { code: -1, message: '请填写用户名和密码' };
  }
  if (username.length < 2 || username.length > 20) {
    return { code: -1, message: '用户名2-20个字符' };
  }
  if (password.length < 4) {
    return { code: -1, message: '密码至少4位' };
  }
  if (invite !== INVITE_CODE) {
    return { code: -1, message: '邀请码错误' };
  }

  // 检查用户名是否已存在
  const existResult = await db.collection(COLLECTION)
    .where({ username: username })
    .limit(1)
    .get();

  if (existResult.data && existResult.data.length > 0) {
    return { code: -1, message: '用户名已存在' };
  }

  // 统计现有用户数，第一个用户为管理员
  const countResult = await db.collection(COLLECTION).count();
  const isFirst = countResult.total === 0;

  const passwordHash = hashPwd(password);
  const newUser = {
    username: username,
    passwordHash: passwordHash,
    role: isFirst ? 'admin' : 'member',
    createdAt: new Date().toISOString(),
    avatar: '',
    nickname: ''
  };

  const addResult = await db.collection(COLLECTION).add(newUser);
  newUser.id = addResult._id;

  return {
    code: 0,
    message: '注册成功！欢迎加入战队' + (isFirst ? '（你已成为管理员）' : ''),
    data: safeUser(newUser)
  };
}

/* ---- 登录 ---- */
async function handleLogin(event) {
  const { username, password } = event;

  if (!username || !password) {
    return { code: -1, message: '请填写用户名和密码' };
  }

  const result = await db.collection(COLLECTION)
    .where({ username: username })
    .limit(1)
    .get();

  if (!result.data || result.data.length === 0) {
    return { code: -1, message: '用户名不存在' };
  }

  const user = result.data[0];
  const inputHash = hashPwd(password);

  // 兼容旧数据的 password 字段和新数据的 passwordHash 字段
  const storedHash = user.passwordHash || user.password;
  if (inputHash !== storedHash) {
    return { code: -1, message: '密码错误' };
  }

  return {
    code: 0,
    message: '登录成功！欢迎回来，' + user.username,
    data: safeUser(user)
  };
}

/* ---- 获取所有用户列表 ---- */
async function handleGetUsers(event) {
  const result = await db.collection(COLLECTION)
    .orderBy('createdAt', 'asc')
    .get();

  const users = (result.data || []).map(safeUser);

  return {
    code: 0,
    data: users
  };
}

/* ---- 更新个人信息 ---- */
async function handleUpdateProfile(event) {
  const { userId, nickname, avatar } = event;

  if (!userId) {
    return { code: -1, message: '缺少用户ID' };
  }

  const updateData = {};
  if (nickname !== undefined) updateData.nickname = nickname;
  if (avatar !== undefined) updateData.avatar = avatar;

  if (Object.keys(updateData).length === 0) {
    return { code: -1, message: '没有要更新的内容' };
  }

  await db.collection(COLLECTION).doc(userId).update(updateData);

  // 返回更新后的用户信息
  const result = await db.collection(COLLECTION).doc(userId).get();
  const user = result.data && result.data.length > 0 ? result.data[0] : null;

  return {
    code: 0,
    message: '个人信息已更新',
    data: safeUser(user)
  };
}

/* ---- 修改密码 ---- */
async function handleChangePassword(event) {
  const { userId, oldPassword, newPassword } = event;

  if (!userId || !oldPassword || !newPassword) {
    return { code: -1, message: '请填写完整信息' };
  }
  if (newPassword.length < 4) {
    return { code: -1, message: '新密码至少4位' };
  }

  // 验证旧密码
  const result = await db.collection(COLLECTION).doc(userId).get();
  if (!result.data || result.data.length === 0) {
    return { code: -1, message: '用户不存在' };
  }

  const user = result.data[0];
  const storedHash = user.passwordHash || user.password;

  if (hashPwd(oldPassword) !== storedHash) {
    return { code: -1, message: '旧密码错误' };
  }

  const newHash = hashPwd(newPassword);
  await db.collection(COLLECTION).doc(userId).update({
    passwordHash: newHash
  });

  return { code: 0, message: '密码修改成功' };
}

/* ---- 设置用户角色（管理员操作） ---- */
async function handleSetRole(event) {
  const { userId, newRole } = event;

  if (!userId || !newRole) {
    return { code: -1, message: '缺少参数' };
  }
  if (newRole !== 'admin' && newRole !== 'member') {
    return { code: -1, message: '无效的角色' };
  }

  const result = await db.collection(COLLECTION).doc(userId).get();
  if (!result.data || result.data.length === 0) {
    return { code: -1, message: '用户不存在' };
  }

  await db.collection(COLLECTION).doc(userId).update({ role: newRole });

  return { code: 0, message: '角色已更新' };
}

/* ---- 检查用户名是否存在 ---- */
async function handleCheckUsername(event) {
  const { username } = event;

  if (!username) {
    return { code: -1, message: '缺少用户名' };
  }

  const result = await db.collection(COLLECTION)
    .where({ username: username })
    .limit(1)
    .get();

  return {
    code: 0,
    exists: result.data && result.data.length > 0
  };
}
