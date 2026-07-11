const { chromium } = require('playwright-core');

const URL = process.argv[2] || 'https://padayon-theta.vercel.app/demo';

function measure(chat) {
  const main = chat.querySelector('main');
  const scroll = chat.querySelector('[class*="overflow-y-auto"]');
  const get = (el) =>
    el
      ? {
          tag: el.tagName,
          class: el.className,
          rect: el.getBoundingClientRect().toJSON(),
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
        }
      : null;
  return {
    chat: get(chat),
    main: get(main),
    scroll: get(scroll),
    body: { rect: document.body.getBoundingClientRect().toJSON(), scrollH: document.body.scrollHeight },
  };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL);
  await page.waitForTimeout(6000);

  const before = await page.evaluate(measure, await page.$('[aria-label="PADAYON chat workspace"]'));
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  // Click first suggestion
  const suggestion = await page.locator('button', { hasText: 'Explain photosynthesis' }).first();
  if (await suggestion.count()) {
    await suggestion.click();
    console.log('Clicked suggestion, waiting for response...');
    // Wait for request to finish (agent thinking disappears)
    await page.waitForFunction(() => {
      const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
      return chat && !chat.textContent.includes('PADAYON is thinking');
    }, { timeout: 120000 });
    await page.waitForTimeout(2000);
  } else {
    console.log('No suggestion found');
  }

  const after = await page.evaluate(measure, await page.$('[aria-label="PADAYON chat workspace"]'));
  console.log('AFTER:', JSON.stringify(after, null, 2));

  await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/demo_after_chat.png' });
  await browser.close();
})();
