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
// A real mouse click at the centre of the pulse heart. Unlike el.click() it is hit-tested like a
// finger, so it fails if anything covers the heart (the progress ring once did).
const tapHeart = async () => {
  const { x, y } = await evaluate(`(() => { const r = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Tap on every beat')).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
}
// pulse: a number to type on the optional pulse card, or 'tap' for two real taps on the heart
// (no-watch check-ins only). Returns whether the two taps were counted.
async function checkIn(energy = '2: Low', pulse = null) {
  await waitFor('How much energy do you have?', 90000)
  await clickSel(`[aria-label="${energy}"]`); await sleep(700)
  await click('That’s right'); await sleep(500)
  await clickSel('[aria-label="3: OK"]'); await sleep(700)
  if (await text('What got in the way')) { await click('Nothing special'); await click('Next'); await sleep(500) }
  await clickSel('[aria-label="2: A little"]'); await sleep(700)
  // Without a watch, soreness moves on (280 ms) to the optional pulse card, which has the Finish button.
  await clickSel('[aria-label="4: Very"]'); await waitFor('Finish check-in', 5000)
  let tapped = false
  if (pulse === 'tap') {
    await tapHeart(); await sleep(900); await tapHeart(); await sleep(300)
    tapped = await text('2 taps')
  } else if (pulse !== null) {
    await click('Enter a number instead'); await sleep(300)
    await evaluate(`document.querySelector('input[type="number"]').focus()`)
    await send('Input.insertText', { text: String(pulse) }); await sleep(200)
  }
  await click('Finish check-in'); await sleep(1500)
  return tapped
}
const restart = async () => { await click('Restart the demo'); await sleep(600) }
try {
  await goto(SITE + '/?presenter=1'); await waitFor('Restart the demo', 90000); await watchErrors() // demo controls are hidden until presenter mode is on

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
  await check('Improved -> Keep the change -> Today says case closed', (await path()) === '/' && await text('Case closed'))

  // Kasia medium data
  await restart(); await btn('Detective'); await sleep(300); await btn('Medium'); await waitFor('The suspects', 90000)
  await check('Kasia medium data level detective', await text('Medium data'))

  // Tomek full flow
  await restart(); await click('Tomek · no watch'); await sleep(300); await btn('Check-in'); await sleep(400)
  await checkIn('1: Empty', 64)
  await check('Tomek check-in lands on Today with Find out why', (await path()) === '/' && await text('Find out why'))
  await check('Tomek (no watch) typed pulse shows on Today', await text('64 bpm'))
  await click('Find out why'); await waitFor('The suspects', 90000)
  await check('Tomek detective basic level, no High confidence', await text('Basic data') && !(await text('High confidence')))
  await click('Accept the mission'); await waitFor('Starts tomorrow', 90000)
  await click('+1 day'); await sleep(800)
  await check('Tomek +1 day opens check-in', (await path()) === '/check-in')
  await check('Tomek: real clicks on the pulse heart count as taps', await checkIn('2: Low', 'tap'))
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
    ['Eye check card in view', () => inView('New clue')],
    ['Tomek mission', async () => (await path()) === '/experiment' && (await has('Starts tomorrow'))],
    ['Mission check card', async () => (await path()) === '/check-in' && (await has('Did you keep your sleep window'))],
    ['Pulse card', async () => (await path()) === '/check-in' && (await has('Tap on every beat'))],
    ['Verdict: to your doctor', async () => (await path()) === '/experiment' && (await has('No clear improvement'))],
    ['Summary screen', async () => (await path()) === '/summary' && (await has('Your doctor summary is ready'))],
    ['Doctor page (PL)', async () => (await path()).startsWith('/s/') && (await has('Zgłoszone przez osobę'))],
    ['Bonus: case closed', async () => (await path()) === '/experiment' && (await has('Mystery solved'))],
  ]
  await click('Take the 2-min tour') // starts the same script; the presenter tools show its notes
  for (let i = 0; i < SCENE_CHECKS.length; i++) {
    if (i > 0) await key('ArrowRight', 39)
    await check(`Scene ${i + 1}: ${SCENE_CHECKS[i][0]}`, await until(SCENE_CHECKS[i][1]))
  }
  await key('ArrowLeft', 37)
  await check('← goes back a scene (from the bonus to the doctor page)', await until(async () => (await path()).startsWith('/s/')))

  // A judge opening the link cold: no presenter tools, the guided tour, then the app on their own.
  const tourNext = () => evaluate(`(document.querySelector('.stage__story .stage-tour__primary') ?? document.querySelector('[aria-label="Next step"], [aria-label="Finish the tour"]')).click()`)
  await goto(SITE + '/?presenter=0'); await sleep(800)
  await evaluate(`localStorage.removeItem('whytired.session.v1'); true`)
  await goto(SITE + '/'); await sleep(1500); await watchErrors()
  await check('Judge: welcome offers the tour, presenter tools hidden', (await has('Take the 2-min tour')) && !(await has('Demo controls')))
  await click('Take the 2-min tour')
  // The tour walks the same scenes as the demo script, so the step numbers come from that list.
  const STEPS = SCENE_CHECKS.length
  const PULSE_STEP = SCENE_CHECKS.findIndex(([name]) => name === 'Pulse card') + 1
  const EYE_STEP = SCENE_CHECKS.findIndex(([name]) => name === 'Eye check card in view') + 1
  await check('Judge: tour step 1 is the check-in', await until(async () => (await path()) === '/check-in' && (await has(`Step 1 of ${STEPS}`))))
  for (let step = 2; step < STEPS; step++) {
    await tourNext(); await sleep(400)
    if (step === EYE_STEP) {
      await until(() => has('New clue: check your eyes'), 30000); await click('Start the eye check'); await sleep(500)
      await check(`Judge: step ${step} is the eye check, and its sheet opens (camera not started)`, (await has(`Step ${step} of ${STEPS}`)) && (await has('Start the camera')))
    }
    if (step === PULSE_STEP) {
      await until(() => has('Tap on every beat'), 10000); await tapHeart(); await sleep(300)
      await check(`Judge: step ${step} is the pulse card, and a real tap counts`, (await has(`Step ${step} of ${STEPS}`)) && (await has('1 tap')))
    }
  }
  await check(`Judge: step ${STEPS - 1} is the doctor page with the tour bar`, await until(async () => (await path()).startsWith('/s/') && (await has(`Step ${STEPS - 1} of ${STEPS}`)) && (await has('Pytania do lekarza'))))
  await tourNext()
  await check(`Judge: step ${STEPS} shows case closed`, await until(async () => (await path()) === '/experiment' && (await has('Mystery solved')) && (await has('Finish'))))
  await tourNext(); await sleep(600)
  await check('Judge: finish shows the end card', await has('That’s WhyTired.'))
  await click('Try it yourself'); await sleep(800)
  await check('Judge: try it yourself starts onboarding', (await path()) === '/onboarding')
  await click('Get started'); await click('Train for a race'); await click('Continue'); await click('Running'); await click('Continue')
  await click('3–4'); await click('30–60 min'); await click('Regularly'); await click('Continue')
  await click('Exams soon'); await click('Continue')
  await click('Just my phone'); await click('Open my case file'); await sleep(300)
  await check('Judge: onboarding opens a case file with the medium data level', await text('Your case file is open') && await text('Medium data'))
  await click('Start my first check-in')
  await checkIn('2: Low')
  await check('Judge: own check-in opens the detective', await until(async () => (await path()) === '/' && (await text('Find out why'))))
  await click('Find out why'); await waitFor('The suspects', 90000)
  await click('Accept the mission'); await waitFor('Starts tomorrow', 90000)
  await click('Demo: skip to day 7'); await waitFor('No clear improvement', 90000)
  await click('Prepare my doctor summary')
  await check('Judge: skip to day 7 reaches the doctor summary', await until(() => text('Pytania do lekarza')))

  results.push('JS errors: ' + (await errors()))
} catch (e) {
  results.push('CRASH ' + e.message + ' at ' + (await path()))
  process.exitCode = 1
} finally {
  console.log(results.join('\n'))
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1
  b.close()
}
