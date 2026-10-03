// Minimal Chrome DevTools Protocol helper for our scripts (Node 22, no extra packages).
// Starts headless Chrome and returns small helpers: goto, waitFor, click, screenshot, printPdf.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function launchBrowser({ profileDir, port = 9333, width = 1280, height = 920, scale = 1 }) {
  const chrome = spawn(
    CHROME,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'],
    { stdio: 'ignore' },
  )

  let targets = []
  for (let i = 0; i < 60 && !targets.length; i++) {
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === 'page')
    } catch {
      // Chrome is still starting
    }
    if (!targets.length) await sleep(250)
  }
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))

  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
  const setViewport = (w, h) =>
    send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false })

  await send('Page.enable')
  await setViewport(width, height)

  return {
    send,
    evaluate,
    setViewport,
    goto: (url) => send('Page.navigate', { url }),
    /** Wait until the visible text contains `text` (note: CSS uppercase changes innerText). */
    async waitFor(text, timeout = 100_000) {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await evaluate(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`)) return
        await sleep(300)
      }
      throw new Error(`Timed out waiting for "${text}"`)
    },
    /** Click the first button or link whose text contains `text`. */
    async click(text) {
      const ok = await evaluate(`(() => {
        const el = [...document.querySelectorAll('button, a')].find((e) => e.innerText.trim().includes(${JSON.stringify(text)}))
        if (!el) return false
        el.click()
        return true
      })()`)
      if (!ok) throw new Error(`No button or link with "${text}"`)
    },
    /** Click the element matching a CSS selector. */
    async clickSelector(selector) {
      const ok = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return false
        el.click()
        return true
      })()`)
      if (!ok) throw new Error(`Nothing matches ${selector}`)
    },
    async screenshot(path, clip) {
      const result = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })
      await fs.writeFile(path, Buffer.from(result.result.data, 'base64'))
    },
    /** Print the page to PDF (A4 from the page's @page rule); returns the number of pages. */
    async printPdf(path) {
      const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
      const bytes = Buffer.from(pdf.result.data, 'base64')
      await fs.writeFile(path, bytes)
      return { pages: (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, kb: Math.round(bytes.length / 1024) }
    },
    close() {
      ws.close()
      chrome.kill()
    },
  }
}
