// Pre-demo rehearsal: clicks through the whole demo on a deployed site and saves a screenshot
// per step plus the printed doctor summary. Also wakes up the free server before the demo.
// Usage: node scripts/e2e-demo.mjs https://whytired-vnvu.onrender.com /tmp/whytired-e2e
// Needs Google Chrome; set CHROME=/path/to/chrome if it is not in the default macOS location.
import fs from 'node:fs/promises'

import { launchBrowser, sleep } from './cdp.mjs'

const SITE = (process.argv[2] ?? 'https://whytired-vnvu.onrender.com').replace(/\/$/, '')
const OUT = process.argv[3] ?? '/tmp/whytired-e2e'
await fs.mkdir(OUT, { recursive: true })

const browser = await launchBrowser({ profileDir: `${OUT}/.chrome` })
const { waitFor, click, evaluate, goto } = browser
const shot = (name) => browser.screenshot(`${OUT}/${name}.png`)
// The first-run tour covers Today until it is skipped (once per browser profile).
const skipTour = async () => {
  const skipped = await evaluate(`(() => {
    const tour = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.innerText.includes('Step 1 of 3'))
    const skip = tour && [...tour.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Skip')
    skip?.click()
    return !!skip
  })()`)
  if (skipped) await sleep(300)
}
const step = async (label, fn) => {
  const start = Date.now()
  await fn()
  console.log(`✓ ${label} (${((Date.now() - start) / 1000).toFixed(1)} s)`)
}

try {
  await goto(`${SITE}/?presenter=1`) // the demo controls are hidden until presenter mode is on
  await waitFor('WhyTired')
  await evaluate(`localStorage.setItem('whytired.session.v1', JSON.stringify({
    personaId: 'kasia', today: '2026-10-04', scenario: 'not_improved', dataLevel: 'full',
    checkins: { '2026-10-04': { energy: 2, sleep_hours: 7, sleep_quality: 3, stress: 2, soreness: 4, ill: false } },
    experiment: null, onboarded: true, goal: 'Train for a race', sports: ['Running'], lang: 'en' }))`)

  await step('Today: coach says rest (API may cold-start)', async () => {
    await goto(`${SITE}/`)
    await waitFor('Rest today')
    await skipTour()
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
  const hasQr = await evaluate(`!!document.querySelector('svg title')`)
  console.log(`  share link: ${shareUrl}\n  QR code rendered: ${hasQr}`)
  await step('Share link opens the doctor page', async () => {
    await goto(shareUrl)
    await waitFor('Kasia, 23 lata')
    await sleep(800)
    await shot('e2e_6_shared')
    const { pages, kb } = await browser.printPdf(`${OUT}/e2e_summary.pdf`)
    console.log(`  printed PDF: ${pages} page(s), ${kb} KB`)
  })
  console.log('E2E PASSED')
} catch (error) {
  console.log(`E2E FAILED: ${error.message}`)
  await shot('e2e_failure').catch(() => {})
  process.exitCode = 1
} finally {
  browser.close()
}
