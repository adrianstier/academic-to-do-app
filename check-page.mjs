import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Log console messages
page.on('console', msg => console.log('[BROWSER]', msg.text()));
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

try {
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  
  // Get all h1 tags
  const h1s = await page.locator('h1').allTextContents();
  console.log('✅ H1 tags found:', h1s);
  
  // Check for specific text
  const hasBealer = await page.locator('text=Bealer Agency').count();
  console.log('✅ "Bealer Agency" text found:', hasBealer, 'times');
  
  // Get page title
  const title = await page.title();
  console.log('✅ Page title:', title);
  
} catch (error) {
  console.log('❌ Error:', error.message);
}

await browser.close();
