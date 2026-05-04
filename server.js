const http = require('http');
const https = require('https');

// API 密钥
const ZHIPU_API_KEY = '97f79bcf497442c5bee72ca8dd423827.0IKy7u89Gk0D0gEP';
const ALI_API_KEY = 'sk-a1dda4bf844b4a5cabc685d83de9ccb0';

// 智谱配置
const ZHIPU_HOST = 'open.bigmodel.cn';
const ZHIPU_PATH = '/api/paas/v4/chat/completions';

// 百炼配置（兼容 OpenAI 格式）
const ALI_HOST = 'dashscope.aliyuncs.com';
const ALI_PATH = '/compatible-mode/v1/chat/completions';

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

        let payload;
        try {
            payload = JSON.parse(body);
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'JSON 解析失败' }));
            return;
        }

        // 提取 provider 和 model
        const provider = payload.provider || 'zhipu';  // 默认智谱
        const model = payload.model;
        if (!model) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 model 参数' }));
            return;
        }

        // 根据 provider 选择 API 配置
        let apiKey, host, path;
        if (provider === 'ali') {
            apiKey = ALI_API_KEY;
            host = ALI_HOST;
            path = ALI_PATH;
        } else {
            apiKey = ZHIPU_API_KEY;
            host = ZHIPU_HOST;
            path = ZHIPU_PATH;
        }

        // 构建发送给上游的请求体（保留原始 messages、stream 等）
        const upstreamBody = JSON.stringify({
            model: model,
            messages: payload.messages,
            stream: payload.stream || false,
            // 其他可能的参数（如 temperature）可以透传，但这里保持简单
        });

        const options = {
            hostname: host,
            path: path,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(upstreamBody)
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            // 如果是流式响应，直接管道传输
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });
                proxyRes.pipe(res);
            } else {
                // 普通 JSON 响应
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

        proxyReq.write(upstreamBody);
        proxyReq.end();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));