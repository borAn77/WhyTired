// Pre-demo rehearsal: clicks through the whole demo on a deployed site (Chrome DevTools Protocol,
// no extra packages) and saves a screenshot per step plus the printed doctor summary.
// Usage: node scripts/e2e-demo.mjs https://whytired-vnvu.onrender.com /tmp/whytired-e2e
// Needs Google Chrome; set CHROME=/path/to/chrome if it is not in the default macOS location.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const SITE = process.argv[2].replace(/\/$/, '')
const OUT = process.argv[3] ?? '/tmp/whytired-e2e'
await fs.mkdir(OUT, { recursive: true })
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const chrome = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/c_e2e`, 'about:blank'],
  { stdio: 'ignore' },
)

let targets = []
for (let i = 0; i < 60 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page')
  } catch {}
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
const shot = async (name) => {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(`${OUT}/${name}.png`, Buffer.from(result.result.data, 'base64'))
}
const waitFor = async (text, timeout = 100_000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`)) return
    await sleep(300)
  }
  throw new Error(`Timed out waiting for "${text}"`)
}
const click = async (text) => {
  const ok = await evaluate(`(() => {
    const el = [...document.querySelectorAll('button, a')].find((e) => e.innerText.trim().includes(${JSON.stringify(text)}))
    if (!el) return false
    el.click()
    return true
  })()`)
  if (!ok) throw new Error(`No button or link with "${text}"`)
}
const step = async (label, fn) => {
  const start = Date.now()
  await fn()
  console.log(`✓ ${label} (${((Date.now() - start) / 1000).toFixed(1)} s)`)
}

try {
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 920, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${SITE}/` })
  await waitFor('WhyTired')
  await evaluate(`localStorage.setItem('whytired.session.v1', JSON.stringify({
    personaId: 'kasia', today: '2026-10-04', scenario: 'not_improved', dataLevel: 'full',
    checkins: { '2026-10-04': { energy: 2, sleep_hours: 7, sleep_quality: 3, stress: 2, soreness: 4, ill: false } },
    experiment: null, onboarded: true, goal: 'Train for a race', sports: ['Running'], lang: 'en' }))`)

  await step('Today: coach says rest (API may cold-start)', async () => {
    await send('Page.navigate', { url: `${SITE}/` })
    await waitFor('Rest today')
    await shot('e2e_1_today')
  })
  await step('Detective: ranked causes', async () => {
    await click('Find out why')
    await waitFor('The suspects')
    await waitFor('High confidence')
    await shot('e2e_2_detective')
  })
  await step('Experiment started', async () => {
    await click('Accept the mission')
    await waitFor('Starts tomorrow')
    await shot('e2e_3_experiment')
  })
  await step('Time travel +7 days: not improved', async () => {
    await click('+7 days')
    await waitFor('No clear improvement')
    await shot('e2e_4_result')
  })
  await step('Doctor summary (Polish)', async () => {
    await click('Prepare my doctor summary')
    await waitFor('Pytania do lekarza')
    await click('Show link and QR code')
    await sleep(500)
    await shot('e2e_5_summary')
  })
  const shareUrl = await evaluate(`document.querySelector('a[target="_blank"]')?.href`)
  const hasQr = await evaluate(`!!document.querySelector('svg title') || !!document.querySelector('svg[role="img"] path')`)
  console.log(`  share link: ${shareUrl}\n  QR code rendered: ${hasQr}`)
  await step('Share link opens the doctor page', async () => {
    await send('Page.navigate', { url: shareUrl })
    await waitFor('Kasia, 23 lata')
    await sleep(800)
    await shot('e2e_6_shared')
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
    const bytes = Buffer.from(pdf.result.data, 'base64')
    await fs.writeFile(`${OUT}/e2e_summary.pdf`, bytes)
    const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    console.log(`  printed PDF: ${pages} page(s), ${(bytes.length / 1024).toFixed(0)} KB`)
  })
  console.log('E2E PASSED')
} catch (error) {
  console.log(`E2E FAILED: ${error.message}`)
  await shot('e2e_failure').catch(() => {})
} finally {
  ws.close()
  chrome.kill()
}
