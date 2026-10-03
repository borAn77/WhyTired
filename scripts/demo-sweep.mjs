// Demo rehearsal: walks every path a presenter might take (restart, jumps that skip onboarding,
// both personas, both experiment outcomes, time travel), then every scene of the demo script
// with the → key, and reports PASS/FAIL plus any JS errors.
// Usage: node scripts/demo-sweep.mjs https://whytired-vnvu.onrender.com
// Needs Google Chrome; set CHROME=/path/to/chrome if it is not in the default macOS location.
import fs from 'node:fs/promises'

import { launchBrowser, sleep } from './cdp.mjs'

// Waits are long (90 s) because the free API can take up to a minute to wake up.
const SITE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const PROFILE = '/tmp/whytired-sweep-chrome'
await fs.rm(PROFILE, { recursive: true, force: true })
const b = await launchBrowser({ profileDir: PROFILE, port: 9351 })
const { click, evaluate, goto, waitFor, send } = b
const path = () => evaluate('location.pathname')
const text = (t) => evaluate(`document.body.innerText.includes(${JSON.stringify(t)})`)
const clickSel = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`)
const btn = (label) => evaluate(`(() => { const el = [...document.querySelectorAll('button, a')].find(e => e.innerText.trim() === ${JSON.stringify(label)}); if (!el) throw new Error('no exact button ${label}'); el.click() })()`)
const watchErrors = () => evaluate(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(e.message)); window.addEventListener('unhandledrejection', e => window.__errs.push(String(e.reason))); true`)
const errors = async () => (await evaluate('JSON.stringify(window.__errs || [])'))
const results = []
const check = async (name, ok) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`) }
async function checkIn(energy = '2: Low') {
  await waitFor('How much energy do you have?', 90000)
  await clickSel(`[aria-label="${energy}"]`); await sleep(700)
  await click('That’s right'); await sleep(500)
  await clickSel('[aria-label="3: OK"]'); await sleep(700)
  if (await text('What got in the way')) { await click('Nothing special'); await click('Next'); await sleep(500) }
  await clickSel('[aria-label="2: A little"]'); await sleep(700)
  await clickSel('[aria-label="4: Very"]'); await sleep(300)
  await click('Finish check-in'); await sleep(1500)
}
const restart = async () => { await click('Restart the demo'); await sleep(600) }
try {
  await goto(SITE + '/'); await sleep(800); await watchErrors()

  await restart(); await btn('Check-in'); await sleep(400); await checkIn()
  await check('B restart -> jump Check-in -> finish lands on Today', (await path()) === '/' && await text('Find out why'))

  await restart(); await btn('Today'); await sleep(1500)
  await check('Restart -> jump Today asks for check-in (no onboarding bounce)', (await path()) === '/' && await text('Start my check-in'))

  await restart(); await btn('Detective'); await waitFor('The suspects', 90000)
  await check('Restart -> jump Detective shows case', await text('Prime suspect') || await text('PRIME SUSPECT'))
  await click('Accept the mission'); await waitFor('Starts tomorrow', 90000)
  await click('+7 days'); await waitFor('No clear improvement', 90000)
  await check('Detective -> mission -> +7 -> not improved verdict', await text('TO YOUR DOCTOR') || await text('To your doctor'))
  await click('Prepare my doctor summary'); await waitFor('Pytania do lekarza', 90000)
  await check('Doctor summary (PL) loads', true)
  await btn('Today'); await sleep(1500)
  await check('Today after +7 (no check-in) asks for check-in, not onboarding', (await path()) === '/' && await text('Start my check-in'))

  await restart(); await btn('Summary'); await sleep(2500)
  await check('Restart -> jump Summary without experiment renders', !(await text('Something went wrong')) && (await path()) === '/summary')

  await restart(); await btn('Experiment'); await sleep(800)
  await check('Restart -> jump Experiment without mission shows empty state', await text('No mission running'))

  // Improved branch
  await restart(); await btn('Detective'); await waitFor('The suspects', 90000)
  await click('Improved'); await sleep(500); await waitFor('The suspects', 90000); await click('Accept the mission'); await waitFor('Starts tomorrow', 90000)
  await click('+7 days'); await waitFor('Mystery solved', 90000)
  await click('Keep the change'); await sleep(1500)
  await check('Improved -> Keep the change -> Today with +100 XP toast', (await path()) === '/' && await text('case closed'))

  // Kasia medium data
  await restart(); await btn('Detective'); await sleep(300); await click('Medium'); await waitFor('The suspects', 90000)
  await check('Kasia medium data level detective', await text('Medium data'))

  // Tomek full flow
  await restart(); await click('Tomek · no watch'); await sleep(300); await btn('Check-in'); await sleep(400)
  await checkIn('1: Empty')
  await check('Tomek check-in lands on Today with Find out why', (await path()) === '/' && await text('Find out why'))
  await click('Find out why'); await waitFor('The suspects', 90000)
  await check('Tomek detective basic level, no High confidence', await text('Basic data') && !(await text('High confidence')))
  await click('Accept the mission'); await waitFor('Starts tomorrow', 90000)
  await click('+1 day'); await sleep(800)
  await check('Tomek +1 day opens check-in', (await path()) === '/check-in')
  await checkIn('2: Low')
  await check('Tomek day-1 check-in lands on Today', (await path()) === '/')
  await click('+7 days'); await sleep(500); await btn('Experiment'); await sleep(2500)
  await check('Tomek verdict shown', await text('VERDICT') || await text('Verdict'))

  // The demo script (lib/scenes.ts), stepped with the → key like a presenter or a clicker.
  const key = async (name, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code })
  }
  const has = (t) => evaluate(`document.body.textContent.includes(${JSON.stringify(t)})`)
  const inView = (t) => evaluate(`(() => {
    const sc = document.querySelector('[data-phone-scroll]'); if (!sc) return false
    const el = [...sc.querySelectorAll('h1, h2, h3, p')].find((e) => e.textContent.includes(${JSON.stringify(t)})); if (!el) return false
    const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect(); return r.top >= s.top && r.top < s.top + s.height / 2 })()`)
  const until = async (fn, ms = 90000) => {
    const t = Date.now()
    while (Date.now() - t < ms) {
      if (await fn()) return true
      await sleep(300)
    }
    return false
  }
  const SCENE_CHECKS = [
    ['Kasia check-in', async () => (await path()) === '/check-in' && (await has('How much energy do you have?'))],
    ['Kasia today', async () => (await path()) === '/' && (await has('Rest today'))],
    ['Clue spotted in view', () => inView('Clue spotted')],
    ['Detective case file', async () => (await path()) === '/detective' && (await has('Full data'))],
    ['Alibi check in view', () => inView('Alibi check')],
    ['Fake clue in view', () => inView('sensor glitches')],
    ['Tomek detective', async () => (await has('Basic data')) && (await has('sleeping less'))],
    ['Tomek mission', async () => (await path()) === '/experiment' && (await has('Starts tomorrow'))],
    ['Mission check card', async () => (await path()) === '/check-in' && (await has('Did you keep your sleep window'))],
    ['Verdict: to your doctor', async () => (await path()) === '/experiment' && (await has('No clear improvement'))],
    ['Summary screen', async () => (await path()) === '/summary' && (await has('Your doctor summary is ready'))],
    ['Doctor page (PL)', async () => (await path()).startsWith('/s/') && (await has('Zgłoszone przez osobę'))],
    ['Bonus: case closed', async () => (await path()) === '/experiment' && (await has('Mystery solved'))],
  ]
  await click('Start from scene 1')
  for (let i = 0; i < SCENE_CHECKS.length; i++) {
    if (i > 0) await key('ArrowRight', 39)
    await check(`Scene ${i + 1}: ${SCENE_CHECKS[i][0]}`, await until(SCENE_CHECKS[i][1]))
  }
  await key('ArrowLeft', 37)
  await check('← goes back a scene (from the bonus to the doctor page)', await until(async () => (await path()).startsWith('/s/')))

  results.push('JS errors: ' + (await errors()))
} catch (e) {
  results.push('CRASH ' + e.message + ' at ' + (await path()))
  process.exitCode = 1
} finally {
  console.log(results.join('\n'))
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1
  b.close()
}
