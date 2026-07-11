const { chromium } = require('playwright-core');

const URL = 'https://padayon-theta.vercel.app/demo';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('crash', () => console.log('PAGE CRASHED'));
  page.on('response', res => {
    if (res.url().includes('/api/agent')) {
      console.log('API response:', res.status(), res.url());
    }
  });

  try {
    await page.goto(URL);
    await page.waitForTimeout(5000);

    const input = await page.$('input[placeholder*="Ask anything"]');
    await input.fill('Show me a visual for photosynthesis');
    await input.press('Enter');
    console.log('Sent visual request');

    await page.waitForFunction(() => {
      const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
      return chat && chat.textContent.includes('PADAYON is thinking');
    }, { timeout: 30000 });

    await page.waitForFunction(() => {
      const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
      return chat && !chat.textContent.includes('PADAYON is thinking');
    }, { timeout: 120000 });

    await page.waitForTimeout(3000);

    const hasIframe = await page.$('iframe') !== null;
    console.log('Has iframe:', hasIframe);

    await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/visual_test.png' });
  } catch (e) {
    console.log('TEST ERROR:', e.message);
    try {
      await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/visual_error.png' });
    } catch {}
  }

  await browser.close();
})();
