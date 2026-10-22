// Tiny static server for the built client (browser tests without the game server): node tools/serve_static.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
const root = path.resolve(new URL('../dist-web', import.meta.url).pathname), port = import.meta.url.endsWith(process.argv[1]?.split('/').pop() || '-') ? +(process.argv[2] || 8123) : 0
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }
export const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
}).listen(port)
