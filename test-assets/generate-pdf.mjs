/**
 * Generate a PDF from the project brief HTML
 * Run: node test-assets/generate-pdf.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generatePDF() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = join(__dirname, 'project-brief.html');
  console.log(`Loading HTML from: ${htmlPath}`);

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  const pdfPath = join(__dirname, 'project-brief.pdf');
  console.log(`Generating PDF to: ${pdfPath}`);

  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    printBackground: true,
  });

  await browser.close();
  console.log('PDF generated successfully!');
}

generatePDF().catch(console.error);
