const http = require('http');
const https = require('https');

const API_KEY = '97f79bcf497442c5bee72ca8dd423827.0IKy7u89Gk0D0gEP';
const API_HOST = 'open.bigmodel.cn';
const API_PATH = '/api/paas/v4/chat/completions';

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

        // 确保开启流式（前端已经传了 stream: true，这里可再强制）
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

        const proxyReq = https.request(options, (proxyRes) => {
            // 如果智谱返回的是流式数据，直接将管道传给客户端
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });
                proxyRes.pipe(res);
            } else {
                // 非流式（可能错误）
                let data = '';
                proxyRes.on('data', chunk => data += chunk);
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(data);
                });
            }
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