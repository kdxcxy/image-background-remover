import { createServer } from 'http';

const REMOVE_BG_KEY = 'QJVrs6ShdVcB229Kvir4XdS5';

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/remove-background') {
    try {
      const body = await getBody(req);
      const { image } = JSON.parse(body);

      if (!image) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '缺少图片数据' }));
        return;
      }

      const removeRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_file_b64: image, size: 'auto' }),
      });

      if (!removeRes.ok) {
        const err = await removeRes.text();
        console.error('Remove.bg error:', removeRes.status, err);
        res.writeHead(removeRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Remove.bg API 错误: ${removeRes.status}` }));
        return;
      }

      const buf = Buffer.from(await removeRes.arrayBuffer());
      const b64 = buf.toString('base64');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ image: b64 }));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

function getBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

server.listen(3100, '0.0.0.0', () => {
  console.log('API server running on http://0.0.0.0:3100');
});
