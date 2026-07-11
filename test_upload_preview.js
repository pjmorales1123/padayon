const { chromium } = require('playwright-core');
const path = require('path');

const URL = 'https://padayon-theta.vercel.app/demo?new=1';
const imagePath = path.join(__dirname, 'test_note.png');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL);
  await page.waitForTimeout(4000);

  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles(imagePath);

  await page.waitForFunction(() => {
    const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
    return chat && chat.textContent.includes('PADAYON is thinking');
  }, { timeout: 60000 });

  await page.waitForFunction(() => {
    const chat = document.querySelector('[aria-label="PADAYON chat workspace"]');
    return chat && !chat.textContent.includes('PADAYON is thinking');
  }, { timeout: 120000 });

  await page.waitForTimeout(3000);

  const userMsg = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('[class*="justify-end"]'));
    const last = bubbles[bubbles.length - 1];
    return last?.textContent?.slice(0, 300) || '';
  });
  const assistantMsg = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('[class*="justify-start"]'));
    const last = bubbles[bubbles.length - 1];
    return last?.textContent?.slice(0, 500) || '';
  });

  console.log('User message preview:', userMsg);
  console.log('Assistant reply:', assistantMsg);

  await page.screenshot({ path: 'C:/Users/Prince/AppData/Local/Temp/upload_preview.png' });
  await browser.close();
})();
