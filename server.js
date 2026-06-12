// ==========================================
//  鱿点猫饼战队网站 - 后端服务
//  提供站点配置、用户数据和视频数据的服务端存储
// ==========================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 80;
const ROOT = __dirname;

// 配置文件路径
const SITE_CONFIG_FILE = path.join(ROOT, 'data', 'site_config.json');
const USERS_FILE = path.join(ROOT, 'users.txt');
const VIDEOS_META_FILE = path.join(ROOT, 'data', 'videos_meta.json');
const VIDEOS_DIR = path.join(ROOT, 'data', 'videos');

// 确保目录存在
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// 初始化 site_config.json
if (!fs.existsSync(SITE_CONFIG_FILE)) {
  fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify({
    logoFile: null,
    navLogoFile: null,
    footerLogoFile: null,
    liveURL: null
  }, null, 2), 'utf-8');
}

// 初始化 videos_meta.json
if (!fs.existsSync(VIDEOS_META_FILE)) {
  fs.writeFileSync(VIDEOS_META_FILE, '[]', 'utf-8');
}

// ========== MIME 类型 ==========
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// ========== API 处理 ==========

function readSiteConfig() {
  try {
    return JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function writeSiteConfig(config) {
  fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function readUsers() {
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(',');
      if (parts.length >= 3) {
        users.push({
          username: parts[0].trim(),
          password: parts[1].trim(),
          role: parts[2].trim()
        });
      }
    }
    return users;
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  let content = '# 鱿点猫饼战队 - 用户登录数据\n';
  content += '# 格式: 用户名,密码,角色\n';
  content += '# admin = 管理员, member = 队员\n';
  content += '# 每行一个用户，以 # 开头的行为注释\n\n';
  for (const u of users) {
    content += `${u.username},${u.password},${u.role}\n`;
  }
  fs.writeFileSync(USERS_FILE, content, 'utf-8');
}

// 读取视频元数据
function readVideosMeta() {
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_META_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

// 写入视频元数据
function writeVideosMeta(videos) {
  fs.writeFileSync(VIDEOS_META_FILE, JSON.stringify(videos, null, 2), 'utf-8');
}

// 解析 JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// 解析 multipart/form-data body（提取文件字段和文件名）
function parseMultipart(req, boundary) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const body = buffer.toString('binary');
      const parts = body.split('--' + boundary);
      const result = { fields: {}, files: {} };

      for (const part of parts) {
        if (part.indexOf('Content-Disposition') === -1) continue;

        // 提取字段名
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) continue;
        const name = nameMatch[1];

        // 提取文件名（如果是文件）
        const filenameMatch = part.match(/filename="([^"]+)"/);

        if (filenameMatch) {
          // 文件字段
          const filename = filenameMatch[1];
          // 找到二进制数据起始位置（\r\n\r\n 之后）
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const rawStart = headerEnd + 4;
          // 去掉末尾的 \r\n
          let rawEnd = part.length;
          if (part.endsWith('\r\n')) rawEnd -= 2;
          const fileData = buffer.slice(
            buffer.toString('binary').indexOf(part.substring(0, headerEnd)) + rawStart,
            buffer.toString('binary').indexOf(part.substring(0, headerEnd)) + rawEnd
          );
          result.files[name] = { filename, data: fileData };
        } else {
          // 普通文本字段
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          let value = part.substring(headerEnd + 4);
          if (value.endsWith('\r\n')) value = value.substring(0, value.length - 2);
          result.fields[name] = value;
        }
      }
      resolve(result);
    });
    req.on('error', reject);
  });
}

// 处理 API 请求
async function handleAPI(req, res, urlPath) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // ====== 站点配置 API ======
  if (urlPath === '/api/config' && req.method === 'GET') {
    const config = readSiteConfig();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(config));
    return true;
  }

  if (urlPath === '/api/config' && req.method === 'PUT') {
    const body = await parseBody(req);
    const config = readSiteConfig();
    // 合并更新（只更新传入的字段）
    if (body.logoFile !== undefined) config.logoFile = body.logoFile || null;
    if (body.navLogoFile !== undefined) config.navLogoFile = body.navLogoFile || null;
    if (body.footerLogoFile !== undefined) config.footerLogoFile = body.footerLogoFile || null;
    if (body.liveURL !== undefined) config.liveURL = body.liveURL || null;
    // 处理旧格式删除
    if (body.logoDataURL !== undefined) delete config.logoDataURL;
    if (body.navLogoDataURL !== undefined) delete config.navLogoDataURL;

    writeSiteConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, config }));
    return true;
  }

  // 重置配置
  if (urlPath === '/api/config/reset' && req.method === 'POST') {
    const config = {
      logoFile: null,
      navLogoFile: null,
      footerLogoFile: null,
      liveURL: null
    };
    writeSiteConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, config }));
    return true;
  }

  // ====== 用户列表 API（公开读取） ======
  if (urlPath === '/api/users' && req.method === 'GET') {
    const users = readUsers();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(users));
    return true;
  }

  // ====== 用户管理 API（管理员用） ======
  if (urlPath === '/api/users' && req.method === 'PUT') {
    const body = await parseBody(req);
    if (body.users && Array.isArray(body.users)) {
      writeUsers(body.users);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid users data' }));
    }
    return true;
  }

  // ====== 视频元数据 API ======
  // 获取所有视频元数据
  if (urlPath === '/api/videos' && req.method === 'GET') {
    const videos = readVideosMeta();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(videos));
    return true;
  }

  // 批量保存视频元数据
  if (urlPath === '/api/videos' && req.method === 'PUT') {
    const body = await parseBody(req);
    if (body.videos && Array.isArray(body.videos)) {
      writeVideosMeta(body.videos);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid videos data' }));
    }
    return true;
  }

  // ====== 视频文件上传 API ======
  if (urlPath === '/api/videos/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'No boundary found' }));
        return true;
      }
      try {
        const parsed = await parseMultipart(req, boundaryMatch[1]);
        const fileField = parsed.files['video'];
        if (!fileField) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No video file uploaded' }));
          return true;
        }
        const videoId = parsed.fields['id'] || ('v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
        const ext = path.extname(fileField.filename) || '.mp4';
        const saveName = videoId + ext;
        fs.writeFileSync(path.join(VIDEOS_DIR, saveName), fileField.data);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          id: videoId,
          filename: saveName,
          url: '/api/videos/file/' + saveName
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Upload failed: ' + e.message }));
      }
      return true;
    }
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Expected multipart/form-data' }));
    return true;
  }

  // ====== 视频文件下载/流式播放 API ======
  if (urlPath.startsWith('/api/videos/file/') && req.method === 'GET') {
    const filename = urlPath.replace('/api/videos/file/', '');
    const filePath = path.join(VIDEOS_DIR, filename);

    // 安全：防止目录遍历
    if (filePath.indexOf(VIDEOS_DIR) !== 0) {
      res.writeHead(403);
      res.end('Forbidden');
      return true;
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('File not found');
      return true;
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME[ext] || 'video/mp4';

    // 支持 Range 请求（视频 seek）
    const range = req.headers['range'];
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      stream.on('error', () => {
        res.end();
      });
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
    return true;
  }

  // ====== 视频删除 API ======
  if (urlPath.startsWith('/api/videos/') && req.method === 'DELETE') {
    const videoId = urlPath.replace('/api/videos/', '');
    // 删除元数据中的条目
    const videos = readVideosMeta();
    const idx = videos.findIndex(v => v.id === videoId);
    if (idx !== -1) {
      videos.splice(idx, 1);
      writeVideosMeta(videos);
    }
    // 删除视频文件（尝试匹配可能的扩展名）
    const exts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    for (const ext of exts) {
      const fp = path.join(VIDEOS_DIR, videoId + ext);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}

// ========== 静态文件服务 ==========
function serveStatic(req, res, urlPath) {
  // 安全：防止目录遍历
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT, safePath);

  // 如果是目录，默认返回 index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 404 - 尝试返回 index.html (SPA fallback)
      const indexPath = path.join(ROOT, 'index.html');
      fs.readFile(indexPath, (err2, data2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>404 - 页面未找到</h1>');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });

  return true;
}

// ========== 启动服务器 ==========
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // 先尝试 API 路由
  const apiHandled = await handleAPI(req, res, urlPath);
  if (apiHandled) return;

  // 否则提供静态文件
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log(`\n  🦑 鱿点猫饼战队网站服务已启动`);
  console.log(`  📡 地址: http://owydmb.icu:${PORT}`);
  console.log(`  📁 根目录: ${ROOT}`);
  console.log(`  💾 配置文件: ${SITE_CONFIG_FILE}`);
  console.log(`  👥 用户文件: ${USERS_FILE}`);
  console.log(`  🎬 视频存储: ${VIDEOS_DIR}`);
  console.log(`\n  按 Ctrl+C 停止服务\n`);
});
