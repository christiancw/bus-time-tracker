import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// Minimal local dev server that mimics Vercel's serverless request/response
// contract so the functions under `api/` can be run without `vercel dev`.
// Each file `api/<name>.js` is served at the route `/api/<name>`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, '..', 'api');
const PORT = process.env.PORT || 3000;

function augmentResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    const payload = JSON.stringify(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(payload);
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  augmentResponse(res);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = Object.fromEntries(url.searchParams.entries());

  // Route: /api/<name> -> api/<name>.js
  const match = url.pathname.match(/^\/api\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) {
    return res.status(404).json({ error: 'Not found', path: url.pathname });
  }

  const handlerFile = path.join(apiDir, `${match[1]}.js`);
  if (!fs.existsSync(handlerFile)) {
    return res.status(404).json({ error: `No handler for ${url.pathname}` });
  }

  try {
    const mod = await import(`${handlerFile}?t=${Date.now()}`);
    const handler = mod.default;
    req.query = query;
    await handler(req, res);
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error('Handler error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Dev server listening on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/arrivals?stopCode=<code>`);
});
