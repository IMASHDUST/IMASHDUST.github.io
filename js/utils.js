/* ==========================================
   YDMB 工具函数 - utils.js
   所有页面共用
   ========================================== */

// Toast 通知
function showToast(msg, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-20 right-4 z-[200] space-y-2';
    document.body.appendChild(container);
  }
  const colors = {
    success: 'border-green-500/50 bg-green-500/10 text-green-400',
    error: 'border-red-500/50 bg-red-500/10 text-red-400',
    info: 'border-ow-orange/50 bg-ow-orange/10 text-ow-orange',
  };
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className =
    'px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ' +
    (colors[type] || colors.info);
  t.innerHTML =
    '<span>' + (icons[type] || icons.info) + '</span><span>' + msg + '</span>';
  t.style.animation = 'slideUp 0.4s ease-out';
  container.appendChild(t);
  setTimeout(function () {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    t.style.transition = 'all 0.3s ease';
    setTimeout(function () { t.remove(); }, 300);
  }, 3000);
}

// HTML 转义
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 生成唯一 ID
function generateId() {
  return (
    'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6)
  );
}

// 时间格式化 (秒 → m:ss)
function formatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// 日期格式化 (相对时间)
function formatDate(dateStr) {
  var d = new Date(dateStr);
  var now = new Date();
  var diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 播放量格式化
function formatViews(views) {
  if (views >= 10000) return (views / 10000).toFixed(1) + '万';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'k';
  return String(views);
}

// 视频分类样式
function getCategoryStyle(category) {
  var styles = {
    '击杀集锦': 'border-red-500/40 text-red-400 bg-red-500/10',
    '战术复盘': 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    '支援集锦': 'border-green-500/40 text-green-400 bg-green-500/10',
    '搞笑时刻': 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
    '训练赛': 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    '自定义': 'border-ow-orange/40 text-ow-orange bg-ow-orange/10',
  };
  return styles[category] || 'border-ow-dark-border text-ow-dark-muted bg-ow-dark-card';
}
