import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/admin/reports/sales', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const btn = page.getByRole('button', { name: 'Export CSV' });
const count = await btn.count();
console.log('button count:', count);
if (count > 0) {
  const box = await btn.first().boundingBox();
  console.log('boundingBox:', JSON.stringify(box));
  const styles = await btn.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const parent = el.parentElement;
    const parentCs = parent ? getComputedStyle(parent) : null;
    return {
      className: el.className,
      display: cs.display,
      width: cs.width,
      flexGrow: cs.flexGrow,
      flexShrink: cs.flexShrink,
      flexBasis: cs.flexBasis,
      alignSelf: cs.alignSelf,
      parentTag: parent?.tagName,
      parentClass: parent?.className,
      parentDisplay: parentCs?.display,
      parentWidth: parentCs?.width,
      siblingCount: parent?.children.length,
    };
  });
  console.log('styles:', JSON.stringify(styles, null, 2));
}
await page.screenshot({ path: '/private/tmp/claude-502/-Users-mohammadjibril-Desktop-Aida-System/b8d16a22-6950-4432-b7b3-91cf5e442259/scratchpad/sales-page.png', fullPage: false });
await browser.close();
