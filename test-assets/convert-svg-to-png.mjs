/**
 * Convert SVG to PNG using Playwright
 * Run: node test-assets/convert-svg-to-png.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function convertSVGtoPNG() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to match SVG size
  await page.setViewportSize({ width: 800, height: 600 });

  const svgPath = join(__dirname, 'whiteboard-notes.svg');
  const svgContent = readFileSync(svgPath, 'utf-8');

  // Create an HTML page with the SVG
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  await page.setContent(html);

  const pngPath = join(__dirname, 'whiteboard-notes.png');
  console.log(`Generating PNG to: ${pngPath}`);

  await page.screenshot({
    path: pngPath,
    type: 'png',
  });

  await browser.close();
  console.log('PNG generated successfully!');
}

convertSVGtoPNG().catch(console.error);
