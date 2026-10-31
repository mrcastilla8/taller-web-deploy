import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }
createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const route = path === '/' || path === '/mis-eventos' || /^\/eventos\/\d+$/.test(path)
    const file = resolve(root, route ? 'index.html' : '.' + path)
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return }
    const content = await readFile(file)
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(req.method === 'HEAD' ? undefined : content)
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Recurso no encontrado.')
  }
}).listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '0.0.0.0', () => console.log('Frontend EventosFISI listo.'))
