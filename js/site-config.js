/* ==========================================
   YDMB 站点配置 - site-config.js
   Logo 编辑 & 直播间设置 - 所有页面共用
   ========================================== */

var SITE_CONFIG_KEY = 'ydmb_site_config';
var tempNavLogoDataURL = null;

function getSiteConfig() {
  try {
    return JSON.parse(localStorage.getItem(SITE_CONFIG_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveSiteConfig(config) {
  localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(config));
}

function applySiteConfig() {
  var config = getSiteConfig();
  var navLogoImg = document.getElementById('nav-logo-img');
  var navLogoSvg = document.getElementById('nav-logo-svg');

  if (config.navLogoDataURL && navLogoImg) {
    navLogoImg.src = config.navLogoDataURL;
    navLogoImg.classList.remove('hidden');
    if (navLogoSvg) navLogoSvg.classList.add('hidden');
  } else {
    if (navLogoImg) {
      navLogoImg.classList.add('hidden');
      navLogoImg.src = '';
    }
    if (navLogoSvg) navLogoSvg.classList.remove('hidden');
  }
}

function openLogoEditModal() {
  var config = getSiteConfig();
  var modal = document.getElementById('logo-edit-modal');
  var urlInput = document.getElementById('logo-edit-url');
  var errEl = document.getElementById('logo-edit-error');

  tempNavLogoDataURL = config.navLogoDataURL || null;

  var navPreviewImg = document.getElementById('nav-logo-edit-preview-img');
  var navPlaceholder = document.getElementById('nav-logo-edit-placeholder');
  var navClearBtn = document.getElementById('nav-logo-edit-clear-btn');

  if (config.navLogoDataURL && navPreviewImg) {
    navPreviewImg.src = config.navLogoDataURL;
    navPreviewImg.classList.remove('hidden');
    if (navPlaceholder) navPlaceholder.classList.add('hidden');
    if (navClearBtn) navClearBtn.classList.remove('hidden');
  } else {
    if (navPreviewImg) {
      navPreviewImg.classList.add('hidden');
      navPreviewImg.src = '';
    }
    if (navPlaceholder) navPlaceholder.classList.remove('hidden');
    if (navClearBtn) navClearBtn.classList.add('hidden');
  }

  if (urlInput) urlInput.value = config.liveURL || '';
  if (errEl) errEl.classList.add('hidden');

  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeLogoEditModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('logo-edit-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function handleNavLogoFileSelect(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (e) {
    tempNavLogoDataURL = e.target.result;

    var previewImg = document.getElementById('nav-logo-edit-preview-img');
    var placeholder = document.getElementById('nav-logo-edit-placeholder');
    var clearBtn = document.getElementById('nav-logo-edit-clear-btn');

    if (previewImg) {
      previewImg.src = tempNavLogoDataURL;
      previewImg.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearNavLogoPreview() {
  tempNavLogoDataURL = null;
  var previewImg = document.getElementById('nav-logo-edit-preview-img');
  var placeholder = document.getElementById('nav-logo-edit-placeholder');
  var clearBtn = document.getElementById('nav-logo-edit-clear-btn');
  var fileInput = document.getElementById('nav-logo-edit-file');

  if (previewImg) {
    previewImg.classList.add('hidden');
    previewImg.src = '';
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (clearBtn) clearBtn.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

function saveLogoConfig() {
  var urlInput = document.getElementById('logo-edit-url');
  var errEl = document.getElementById('logo-edit-error');
  var liveURL = urlInput ? urlInput.value.trim() : '';

  if (liveURL && !/^https?:\/\/.+/.test(liveURL)) {
    if (errEl) {
      errEl.textContent =
        '请输入有效的直播间地址（以 http:// 或 https:// 开头）';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');

  var config = getSiteConfig();
  config.navLogoDataURL = tempNavLogoDataURL || null;
  config.liveURL = liveURL || null;
  saveSiteConfig(config);
  applySiteConfig();
  closeLogoEditModal();
  showToast('配置已保存', 'success');
}

function resetLogoConfig() {
  if (confirm('确定恢复默认图标和直播间设置？')) {
    var config = getSiteConfig();
    config.navLogoDataURL = null;
    config.liveURL = null;
    saveSiteConfig(config);
    applySiteConfig();
    closeLogoEditModal();
    showToast('已恢复默认设置', 'info');
  }
}
