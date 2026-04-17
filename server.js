const http = require('http');
const https = require('https');

const ZHIPU_API = 'open.bigmodel.cn';
// 优先读取环境变量，如果没有则使用硬编码（建议在 Railway Variables 中设置 ZHIPU_API_KEY）
const API_KEY = process.env.ZHIPU_API_KEY || '97f79bcf497442c5bee72ca8dd423827.0IKy7u89Gk0D0gEP';

const server = http.createServer((req, res) => {
  // 1. 处理 CORS 预检请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 2. 仅允许 POST 请求
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '仅支持 POST 请求' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // 【核心修改】：智谱 V4 接口使用 Bearer 认证
    const options = {
      hostname: ZHIPU_API,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`, 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proxy = https.request(options, (proxyRes) => {
      // 将 API 的状态码和头信息原样传递给前端
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*' 
      });
      proxyRes.pipe(res);
    });

    proxy.on('error', (e) => {
      console.error('Proxy Error:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '代理服务器内部错误: ' + e.message }));
    });

    proxy.write(body);
    proxy.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));