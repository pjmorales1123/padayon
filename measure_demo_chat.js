const { chromium } = require('playwright-core');

const URL = process.argv[2] || 'https://padayon-theta.vercel.app/demo';

function measure() {
  const get = (sel) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    return el
      ? {
          tag: el.tagName,
          class: el.className,
          rect: el.getBoundingClientRect().toJSON(),
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
          computed: { height: window.getComputedStyle(el).height, maxHeight: window.getComputedStyle(el).maxHeight, minHeight: window.getComputedStyle(el).minHeight, overflow: window.getComputedStyle(el).overflow },
        }
      : null;
  };
  const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
  const wrapper = chat?.parentElement;
  const chatPanel = wrapper?.parentElement;
  return {
    main: get('main'),
    grid: get('main > div.grid'),
    chatPanel: get(chatPanel),
    wrapper: get(wrapper),
    chat: get(chat),
    chatMain: get(chat?.querySelector('main')),
    scroll: get(chat?.querySelector('[class*="overflow-y-auto"]')),
    body: get(document.body),
  };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL);
  await page.waitForTimeout(6000);

  const before = await page.evaluate(measure);
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  const suggestion = await page.locator('button', { hasText: 'Explain photosynthesis' }).first();
  if (await suggestion.count()) {
    await suggestion.click();
    console.log('Clicked suggestion, waiting for response...');
    await page.waitForFunction(() => {
      const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
      return chat && !chat.textContent.includes('PADAYON is thinking');
    }, { timeout: 120000 });
    await page.waitForTimeout(2000);
  } else {
    console.log('No suggestion found');
  }

  const after = await page.evaluate(measure);
  console.log('AFTER:', JSON.stringify(after, null, 2));

  await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/demo_after_chat.png' });
  await browser.close();
})();
