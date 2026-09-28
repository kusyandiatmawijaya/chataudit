const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  console.log('Navigating to http://auditwa.padmasaripangan.co.id/ ...');
  await page.goto('http://auditwa.padmasaripangan.co.id/', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
