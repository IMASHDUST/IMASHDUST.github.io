/* ==========================================
   YDMB CloudBase 初始化 - cloudbase.js
   - 初始化 CloudBase JS SDK
   - 匿名登录（用于调用云函数）
   - 提供 callCloudFunc 封装函数
   ========================================== */

var cloudbaseApp = null;
var cloudbaseReady = false;
var _cbAuthPromise = null;

/* ---- 初始化 CloudBase ---- */
(function initCloudBase() {
  if (typeof cloudbase === 'undefined') {
    console.error('[CloudBase] SDK 未加载，请确认页面已引入 cloudbase.full.js');
    return;
  }

  cloudbaseApp = cloudbase.init({
    env: 'owydmb-d3ga2ncop11b11016'
  });

  // 匿名登录
  var auth = cloudbaseApp.auth({ persistence: 'local' });
  _cbAuthPromise = auth.anonymousAuthProvider().signIn()
    .then(function (loginState) {
      cloudbaseReady = true;
      console.log('[CloudBase] 匿名登录成功');
      return loginState;
    })
    .catch(function (err) {
      console.error('[CloudBase] 匿名登录失败:', err);
      // 即使匿名登录失败，也尝试继续（某些操作可能仍可用）
      cloudbaseReady = true;
    });
})();

/* ---- 调用云函数封装（自动等待初始化完成） ---- */
function callCloudFunc(name, data) {
  return (_cbAuthPromise || Promise.resolve())
    .then(function () {
      return cloudbaseApp.callFunction({ name: name, data: data || {} });
    })
    .then(function (res) {
      return res.result;
    })
    .catch(function (err) {
      console.error('[CloudBase] 云函数调用失败:', err);
      return { code: -99, message: '网络错误，请稍后重试' };
    });
}
