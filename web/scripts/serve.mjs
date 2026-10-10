import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
// Serve only web assets or the docs deployment. Includes a project-subpath mount for QA.
createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') { res.writeHead(302,{Location:'/web/'}); res.end(); return; }
    pathname = pathname.replace(/^\/mine-duel\//,'/docs/');
    if (!/^\/(web|docs)\//.test(pathname)) { res.writeHead(404); res.end('Not found'); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const relative = pathname.slice(1);
    const filename = path.resolve(workspace,relative);
    const allowed = ['web','docs'].some(folder => filename.startsWith(path.join(workspace,folder)+path.sep));
    if (!allowed || /\b(node_modules|tests|test-results)\b/.test(relative)) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/web/\nPages subpath QA: http://127.0.0.1:${port}/mine-duel/`));
