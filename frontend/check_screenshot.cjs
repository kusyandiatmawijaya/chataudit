const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://auditwa.padmasaripangan.co.id/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'prod_screenshot.png' });
  
  await browser.close();
})();
