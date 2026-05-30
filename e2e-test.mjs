import { chromium } from '@playwright/test';
import path from 'path';

const SCREENSHOTS = '/Users/mateootero-diaz/ASI_Hackathon/Delayed_Propagation/e2e-screenshots';
const BASE = 'http://localhost:3002';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: undefined,
  });

  // Capture console errors
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  const results = [];

  function pass(step, reason) {
    console.log(`PASS [${step}]: ${reason}`);
    results.push({ step, status: 'PASS', reason });
  }
  function fail(step, reason) {
    console.log(`FAIL [${step}]: ${reason}`);
    results.push({ step, status: 'FAIL', reason });
  }

  // Step 1: Page loads
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS}/01-page-load.png`, fullPage: false });
    const title = await page.title();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasMap = await page.locator('canvas, .leaflet-container, [class*="map"], svg').count();
    const isBlank = bodyText.trim().length < 10 && hasMap === 0;
    if (isBlank) {
      fail('01-page-load', 'Page appears blank - no map elements found');
    } else {
      pass('01-page-load', `Page loaded, title="${title}", map elements=${hasMap}`);
    }
  } catch (e) {
    fail('01-page-load', e.message);
  }

  // Step 2: Simulation mode active
  try {
    // Look for Simulation button being active (cyan style)
    const simBtn = page.locator('button', { hasText: /simulation/i }).first();
    const simExists = await simBtn.count();
    const simText = simExists ? await simBtn.textContent() : 'NOT FOUND';

    // Check for airport labels
    const airportLabels = await page.locator('text=KFLL, text=KMIA, text=MKJP').count().catch(() => 0);
    const anyLabel = await page.locator('text=/KFLL|KMIA|MKJP|TJSJ/').count().catch(() => 0);

    // Purple dots / airport markers
    const markers = await page.locator('[class*="airport"], [class*="marker"], circle').count().catch(() => 0);

    await page.screenshot({ path: `${SCREENSHOTS}/02-simulation-mode.png` });

    if (simExists > 0) {
      pass('02-simulation-mode', `Simulation button found ("${simText.trim()}"), airport text matches=${anyLabel}, markers=${markers}`);
    } else {
      fail('02-simulation-mode', `Simulation button not found. Airport labels=${anyLabel}`);
    }
  } catch (e) {
    fail('02-simulation-mode', e.message);
  }

  // Step 3: Play button — click and wait
  try {
    const playBtn = page.locator('button', { hasText: /play|▶|pause/i }).first();
    const playExists = await playBtn.count();
    if (playExists) {
      await playBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOTS}/03-play-aircraft.png` });
      // Look for aircraft emoji or flight markers
      const aircraft = await page.locator('text=/✈|✈️/', { }).count().catch(() => 0);
      const flightEls = await page.locator('[class*="flight"], [class*="aircraft"], [class*="plane"]').count().catch(() => 0);
      pass('03-play-button', `Play clicked, aircraft emoji elements=${aircraft}, flight elements=${flightEls}`);
    } else {
      fail('03-play-button', 'Play button not found');
    }
  } catch (e) {
    fail('03-play-button', e.message);
  }

  // Step 4: Speed control — 60x
  try {
    const speedBtn = page.locator('button', { hasText: /60x/i }).first();
    const speedExists = await speedBtn.count();
    if (speedExists) {
      await speedBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS}/04-speed-60x.png` });
      pass('04-speed-control', '60x speed button found and clicked');
    } else {
      // Try other speed buttons
      const anySpeed = await page.locator('button', { hasText: /\d+x/i }).all();
      const speedTexts = await Promise.all(anySpeed.map(b => b.textContent()));
      fail('04-speed-control', `60x button not found. Available speed buttons: ${speedTexts.join(', ')}`);
      await page.screenshot({ path: `${SCREENSHOTS}/04-speed-60x.png` });
    }
  } catch (e) {
    fail('04-speed-control', e.message);
  }

  // Step 5: TFR injection — Inject Event
  try {
    const injectBtn = page.locator('button', { hasText: /inject event/i }).first();
    const injectExists = await injectBtn.count();
    if (injectExists) {
      await injectBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS}/05-tfr-injection.png` });
      // Check for red/amber polygon or event in feed
      const polygon = await page.locator('[class*="tfr"], [class*="zone"], [fill="red"], [fill="#ff"], [stroke="red"]').count().catch(() => 0);
      const feedItems = await page.locator('[class*="event"], [class*="feed"] li, [class*="alert"]').count().catch(() => 0);
      pass('05-tfr-injection', `Inject Event clicked, TFR polygon elements=${polygon}, feed items=${feedItems}`);
    } else {
      fail('05-tfr-injection', 'Inject Event button not found');
      await page.screenshot({ path: `${SCREENSHOTS}/05-tfr-injection.png` });
    }
  } catch (e) {
    fail('05-tfr-injection', e.message);
  }

  // Step 6: Live mode toggle
  try {
    const liveBtn = page.locator('button', { hasText: /^live$/i }).first();
    const liveExists = await liveBtn.count();
    if (liveExists) {
      await liveBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS}/06-live-mode.png` });
      // Confirm simulation controls disappear
      const simControls = await page.locator('[class*="SimulationControls"], button:text("Play"), button:text("Pause")').count().catch(() => 0);
      const liveMsg = await page.locator('text=/live mode|polling|switched/i').count().catch(() => 0);
      pass('06-live-mode', `Live clicked, sim controls visible=${simControls}, live message elements=${liveMsg}`);
    } else {
      const allBtns = await page.locator('header button, nav button').all();
      const btnTexts = await Promise.all(allBtns.map(b => b.textContent().catch(() => '')));
      fail('06-live-mode', `Live button not found. Header buttons: ${btnTexts.map(t => t.trim()).filter(Boolean).join(', ')}`);
      await page.screenshot({ path: `${SCREENSHOTS}/06-live-mode.png` });
    }
  } catch (e) {
    fail('06-live-mode', e.message);
  }

  // Step 7: Console errors
  if (consoleErrors.length === 0) {
    pass('07-console-errors', 'No console errors detected');
  } else {
    fail('07-console-errors', `${consoleErrors.length} console error(s) found`);
    consoleErrors.forEach((e, i) => console.log(`  Error ${i+1}: ${e}`));
  }

  await browser.close();

  console.log('\n=== SUMMARY ===');
  results.forEach(r => console.log(`${r.status} [${r.step}]: ${r.reason}`));
  console.log('\nConsole errors:');
  if (consoleErrors.length === 0) {
    console.log('  None');
  } else {
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('\nScreenshots saved to:', SCREENSHOTS);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
