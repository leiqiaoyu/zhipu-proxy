const http = require('http');
const https = require('https');

// 直接硬编码你的 Key
const API_KEY = '97f79bcf497442c5bee72ca8dd423827.0IKy7u89Gk0D0gEP';
const API_HOST = 'open.bigmodel.cn';
const API_PATH = '/api/paas/v4/chat/completions';

const server = http.createServer((req, res) => {
    // 1. 基础 CORS 设置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 2. 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '仅支持 POST 请求' }));
        return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        if (!body || body.trim() === '') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '请求体为空' }));
            return;
        }

        // 3. 构建发给智谱的请求
        const options = {
            hostname: API_HOST,
            path: API_PATH,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        // 4. 发起代理请求
        const proxyReq = https.request(options, (proxyRes) => {
            let proxyData = '';
            proxyRes.on('data', chunk => proxyData += chunk);
            
            proxyRes.on('end', () => {
                // 🔑 核心修复：强制保证返回给前端的永远是合法 JSON
                let finalPayload;
                try {
                    JSON.parse(proxyData); // 验证是否为合法 JSON
                    finalPayload = proxyData;
                } catch (e) {
                    // 如果智谱返回了 HTML/纯文本报错，包装成 JSON 防止前端崩溃
                    finalPayload = JSON.stringify({
                        proxy_status: proxyRes.statusCode,
                        zhipu_raw_response: proxyData.substring(0, 300) // 截取关键错误信息
                    });
                    proxyRes.statusCode = 502;
                    console.warn('⚠️ 智谱返回了非 JSON 数据:', proxyData.substring(0, 200));
                }

                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(finalPayload);
            });
        });

        proxyReq.on('error', (e) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '代理服务器连接失败', details: e.message }));
        });

        proxyReq.write(body);
        proxyReq.end();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));