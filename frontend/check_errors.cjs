const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  console.log('Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/');
  
  // Set localStorage
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake-token-for-testing');
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      username: 'admin',
      role: 'DEVELOPER'
    }));
  });
  
  console.log('Reloading to bypass login...');
  await page.goto('http://localhost:4173/');
  await new Promise(r => setTimeout(r, 5000));
  
  // also check /data-management
  console.log('Navigating to /data-management...');
  await page.goto('http://localhost:4173/data-management');
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
