// Submission screenshots: walks through the app like the presenter and saves crisp (2×)
// phone-only images, the doctor summary page and its one-page PDF.
// Usage: node scripts/screenshots.mjs http://localhost:5173 docs/screenshots
import fs from 'node:fs/promises'

import { launchBrowser, sleep } from './cdp.mjs'

const SITE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const OUT = process.argv[3] ?? 'docs/screenshots'
await fs.mkdir(OUT, { recursive: true })

const browser = await launchBrowser({ profileDir: `/tmp/whytired-shots-chrome`, port: 9334, scale: 2 })
const { waitFor, click, clickSelector, evaluate, goto } = browser

/** Screenshot of the phone frame only (with a little margin), optionally scrolled to some text. */
async function phone(name, scrollToText) {
  await evaluate(`(() => {
    const scroller = document.querySelector('[data-phone-scroll]')
    if (!${JSON.stringify(scrollToText ?? null)}) { scroller.scrollTop = 0; return }
    const target = [...scroller.querySelectorAll('h1, h2, h3, p, button, figcaption')]
      .find((el) => el.innerText.includes(${JSON.stringify(scrollToText ?? '')}))
    if (target) scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 80
  })()`)
  await sleep(400)
  const rect = await evaluate(`(() => {
    const r = document.querySelector('[data-phone-frame]').getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })()`)
  const margin = 28
  await browser.screenshot(`${OUT}/${name}.png`, {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  })
  console.log(`✓ ${name}`)
}

const answer = (question, option) => clickSelector(`[role="radiogroup"][aria-label="${question}"] [role="radio"]:nth-child(${option})`)

try {
  // Fresh start: onboarding
  await goto(`${SITE}/`)
  await waitFor('Find out why')
  await phone('01-onboarding')
  await click('Get started')
  await click('Train for a race')
  await click('Continue')
  await click('Running')
  await click('Continue')
  await click('Yes, I wear one')
  await phone('02-onboarding-watch')

  // Morning check-in
  await click('Start my first check-in')
  await waitFor('How much energy do you have?')
  await answer('How much energy do you have?', 2)
  await answer('How well did you sleep?', 3)
  await answer('How stressed do you feel?', 2)
  await answer('How sore are your muscles?', 4)
  await phone('03-check-in')

  // Daily coach
  await click("Done: see today's advice")
  await waitFor('Rest today')
  await phone('04-today-coach')

  // Detective mode
  await click('Find out why')
  await waitFor('High confidence')
  await phone('05-detective')
  await phone('06-detective-causes', 'The suspects')
  await phone('07-detective-evidence', 'Training load per week')
  await click('How sure are we?')
  await phone('08-detective-confidence', 'Alibi check')
  await phone('09-detective-excluded-data', 'sensor glitches thrown out')
  await phone('10-detective-next-step', 'Cut your training load')

  // Experiment → +7 days → not improved
  await click('Accept the mission')
  await waitFor('Starts tomorrow')
  await phone('11-experiment-started')
  await click('+7 days')
  await waitFor('No clear improvement')
  await phone('12-experiment-not-improved')

  // Doctor summary: share link + QR
  await click('Prepare my doctor summary')
  await waitFor('Pytania do lekarza')
  await phone('13-doctor-summary-in-app')
  await click('Show link and QR code')
  await phone('14-share-qr', 'Share with your doctor')

  // The page the doctor sees, full length, and its print
  const shareUrl = await evaluate(`document.querySelector('a[target="_blank"]')?.href`)
  await goto(shareUrl)
  await waitFor('Kasia, 23 lata')
  await sleep(800)
  const height = await evaluate('document.documentElement.scrollHeight')
  await browser.setViewport(1280, height)
  await sleep(500)
  await browser.screenshot(`${OUT}/15-doctor-page.png`)
  console.log('✓ 15-doctor-page')
  const { pages } = await browser.printPdf(`${OUT}/doctor-summary-kasia-pl.pdf`)
  console.log(`✓ doctor-summary-kasia-pl.pdf (${pages} page)`)
  await browser.setViewport(1280, 920)

  // No-watch persona
  await goto(`${SITE}/`)
  await evaluate(`localStorage.setItem('whytired.session.v1', JSON.stringify({
    personaId: 'tomek', today: '2026-10-04', scenario: 'not_improved', dataLevel: 'basic', checkins: {},
    experiment: null, onboarded: true, goal: 'Get stronger', sports: ['Gym'], lang: 'en' }))`)
  await goto(`${SITE}/detective`)
  await waitFor('Medium confidence')
  await phone('16-no-watch-detective')

  // The whole demo setup (phone + presenter controls)
  await browser.screenshot(`${OUT}/00-demo-setup.png`)
  console.log('✓ 00-demo-setup')
} catch (error) {
  console.log(`FAILED: ${error.message}`)
  await browser.screenshot(`${OUT}/failure.png`).catch(() => {})
  process.exitCode = 1
} finally {
  browser.close()
}
