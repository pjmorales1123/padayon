const { chromium } = require('playwright-core');

const URL = 'https://padayon-theta.vercel.app/demo';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL);
  await page.waitForTimeout(5000);

  const input = await page.$('input[placeholder*="Ask anything"]');
  await input.fill('Show me a visual for photosynthesis');
  await input.press('Enter');

  await page.waitForFunction(() => {
    const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
    return chat && chat.textContent.includes('PADAYON is thinking');
  }, { timeout: 30000 });

  await page.waitForFunction(() => {
    const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
    return chat && !chat.textContent.includes('PADAYON is thinking');
  }, { timeout: 120000 });

  await page.waitForTimeout(3000);

  // Measure iframe height and scroll to the visual widget
  const dims = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const widget = iframe?.closest('[class*="rounded-2xl"]');
    return {
      iframeHeight: iframe?.style?.height,
      iframeClientH: iframe?.clientHeight,
      widgetRect: widget?.getBoundingClientRect(),
    };
  });
  console.log('Visual dims:', JSON.stringify(dims, null, 2));

  // Scroll the chat so the visual widget is at the top
  const widget = await page.$('iframe');
  if (widget) {
    await widget.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/visual_focused.png' });
  await browser.close();
})();
