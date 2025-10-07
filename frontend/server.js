import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const port = parseInt(process.env.PORT || '9101', 10)
const hostname = process.env.HOST || '0.0.0.0'
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const useUnixSocket = process.env.UNIX_SOCKET === '1' || process.env.UNIX_SOCKET_PATH
const socketPath = process.env.UNIX_SOCKET_PATH || join(__dirname, 'tmp', 'taskosaur-frontend.sock')

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  if (useUnixSocket) {
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath)
    }
    
    const socketDir = dirname(socketPath)
    if (!fs.existsSync(socketDir)) {
      fs.mkdirSync(socketDir, { recursive: true })
    }
    
    server.listen(socketPath, () => {
      fs.chmodSync(socketPath, 0o666)
      console.log(`> Server listening on Unix socket: ${socketPath} as ${dev ? 'development' : process.env.NODE_ENV}`)
    })
  } else {
    server.listen(port, hostname, () => {
      console.log(`> Server listening at http://${hostname}:${port} as ${dev ? 'development' : process.env.NODE_ENV}`)
    })
  }
})