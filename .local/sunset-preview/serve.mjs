import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = new URL('./index.html', import.meta.url);
const server = createServer(async (request, response) => {
  if (request.url !== '/' && request.url !== '/index.html') {
    response.writeHead(404); response.end('Not found'); return;
  }
  try {
    const body = await readFile(html);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('Preview unavailable');
  }
});
server.listen(4174, '127.0.0.1', () => console.log('Prévia local: http://127.0.0.1:4174'));
