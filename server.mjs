import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const allowed = new Set(['index.html', 'app.js', 'data.js', 'workflow.js', 'scene.js', 'style.css', 'connected-store.js', 'frontline-state.js', 'operations.js', 'connected-store.css', 'slack-shell.js', 'slack-shell.css', 'client-dialogs.css', 'click-guidance.js', 'click-guidance.css', 'presenter-content.js', 'presenter.css', 'external-guidance.css', 'identities.js', 'identities.css', 'slack-realism.css','shell-refinements.css','workspace-layout.css', 'huddle.js', 'huddle.css', 'PRESENTER-SCRIPT.md']);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/markdown; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8'};
const port = Number(process.env.PORT || 4175);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = pathname === '/' ? 'index.html' : pathname.slice(1);
    const target = resolve(root, path);
    if (!target.startsWith(root + (root.endsWith(sep) ? '' : sep)) || !(allowed.has(path) || /^(assets|vendor)\/[a-zA-Z0-9._-]+$/.test(path))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const data = await readFile(target);
    res.writeHead(200, {'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff'});
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`El Jannah Store OS: http://127.0.0.1:${port}`));
