/* =====================================================================
   Local development server.

   Serves public/ and routes /api/* to the same function Netlify runs, so
   the app can be exercised end to end without deploying.

   Usage:
     DATABASE_URL=... SESSION_SECRET=... node dev-server.mjs [port]
   ===================================================================== */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');
const PORT = Number(process.argv[2] ?? 8888);

const { default: apiHandler } = await import('./netlify/functions/api.mjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// The friendly URLs declared in netlify.toml.
const REWRITES = { '/omr': '/omr.html', '/result': '/result.html', '/admin': '/admin.html', '/': '/index.html' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);

    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      duplex: 'half',
    });

    const out = await apiHandler(request);
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }

  const rel = REWRITES[url.pathname] ?? url.pathname;
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`dev server on http://127.0.0.1:${PORT}`));
