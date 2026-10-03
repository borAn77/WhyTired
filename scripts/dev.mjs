// Local dev in one terminal: the FastAPI backend (:8000) and the Vite frontend (:5173, which
// proxies /api to the backend). Ctrl+C stops both; if one of them stops, the other is stopped too.
// Usage (from the repo root): node scripts/dev.mjs
import { spawn } from 'node:child_process'

const root = new URL('..', import.meta.url)
const servers = [
  // uv is a real executable on every OS, so no shell is needed.
  ['backend', 'uv', ['run', 'uvicorn', 'app.main:app', '--reload']],
  // Vite is started with node directly, not through npm: on Windows, Ctrl+C on npm.cmd asks
  // "Terminate batch job (Y/N)?" and leaves the terminal hanging.
  ['frontend', process.execPath, ['node_modules/vite/bin/vite.js']],
]

const children = servers.map(([dir, cmd, args]) => {
  const child = spawn(cmd, args, { cwd: new URL(dir, root), stdio: 'inherit' })
  child.on('error', (err) => {
    console.error(`[${dir}] could not start ${cmd}: ${err.message}`)
    stopAll(1)
  })
  child.on('exit', (code) => stopAll(code ?? 0))
  return child
})

function stopAll(code) {
  process.exitCode ||= code
  for (const child of children) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue
    // On Windows kill() stops only uv and leaves uvicorn running; taskkill /T stops the whole tree.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill()
  }
}

// Ctrl+C reaches both servers directly; wait for them to shut down instead of exiting first.
process.on('SIGINT', () => {})
