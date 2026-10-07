'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const chat = require('./api/chat');
const fetchSource = require('./api/fetch');

const root = __dirname;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/chat') return chat(req, res);
  if (pathname === '/api/fetch') return fetchSource(req, res);
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(root + path.sep)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('content-type', mime[path.extname(filePath)] || 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
  });
});
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`Source AI preview listening on 0.0.0.0:${port}`));
