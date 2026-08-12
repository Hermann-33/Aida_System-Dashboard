import { test, expect, type Page } from '@playwright/test';

const FORBIDDEN = /\/api(?:\/|$|\?)|:3001(?:\/|$)|:3011(?:\/|$)|neon\.tech|render\.com|railway\.app/i;

async function enrolPreview(page: Page) {
  await page.goto('/employee');
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/employee', { waitUntil: 'networkidle' });

  const reset = page.getByRole('button', { name: /reset preview terminal/i });
  if (await reset.count()) {
    await reset.click();
    await page.waitForTimeout(200);
  }

  const enrol = page.getByLabel(/enrolment code/i);
  await expect(enrol).toBeVisible({ timeout: 15_000 });
  await enrol.fill('AIDA-482731');
  await page.getByRole('button', { name: /activate terminal/i }).click();
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /nadia/i })).toBeVisible({ timeout: 10_000 });
}

/** Shared-terminal login: tap a name from the roster, enter the shared demo PIN. */
async function login(page: Page, staffUsername: string) {
  await page.getByRole('button', { name: new RegExp(staffUsername, 'i') }).click();
  await page.getByLabel(/^pin$/i).fill('4821');
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

test.describe('Preview closure gate (no backend)', () => {
  test('employee access enrolment completes without forbidden requests', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (req) => {
      if (FORBIDDEN.test(req.url())) hits.push(req.url());
    });
    await enrolPreview(page);
    expect(hits, `Forbidden requests: ${hits.join(', ')}`).toEqual([]);
  });

  test('staff routes to POS and is blocked from Admin', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (req) => {
      if (FORBIDDEN.test(req.url())) hits.push(req.url());
    });
    await enrolPreview(page);
    await login(page, 'nadia');
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
    await expect(page.getByRole('complementary', { name: 'POS context' })).toBeVisible();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Unauthorized/i })).toBeVisible();
    expect(hits).toEqual([]);
  });

  test('admin routes to Office and is blocked from POS checkout', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (req) => {
      if (FORBIDDEN.test(req.url())) hits.push(req.url());
    });
    await enrolPreview(page);
    await login(page, 'siti');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Executive Dashboard|Aida Office/i }).first()).toBeVisible();
    await page.goto('/pos');
    await expect(page).not.toHaveURL(/\/pos$/, { timeout: 10_000 });
    expect(hits).toEqual([]);
  });

  test('dual-role requires explicit workspace selection', async ({ page }) => {
    await enrolPreview(page);
    await login(page, 'amir');
    await expect(page).toHaveURL(/select-role/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Choose workspace/i })).toBeVisible();
  });

  test('locations and marketing pages render', async ({ page }) => {
    // These used to be their own routes (/admin/operations/sales-points,
    // /admin/rewards/ads) — both pages got folded into tabs of a merged
    // page (Locations, Marketing) to cut down the admin nav's page count.
    await enrolPreview(page);
    await login(page, 'siti');
    await page.goto('/admin/operations/branches');
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible();
    await page.getByRole('tab', { name: /Sales point directory/i }).click();
    await expect(page.getByText(/no location API yet/i)).toBeVisible();
    await page.goto('/admin/rewards/campaigns');
    await expect(page.getByRole('heading', { name: /Marketing/i })).toBeVisible();
    await page.getByRole('tab', { name: /Ads & banners/i }).click();
    await expect(page.getByRole('heading', { name: /Placement preview/i })).toBeVisible();
  });

  test('runtime network isolation across POS open-shift', async ({ page }) => {
    const hits: string[] = [];
    await page.route('**/api/v1/catalogue', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        revision: 1,
        categories: [
          { id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 1 },
        ],
        items: [{
          id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
          name: 'Latte', description: '', basePriceSen: 1050, isAvailable: true, isPublished: true,
          isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
          prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: [], variants: [],
        }],
      }),
    }));
    page.on('request', (req) => {
      const isSharedCatalogue = new URL(req.url()).pathname === '/api/v1/catalogue';
      if (FORBIDDEN.test(req.url()) && !isSharedCatalogue) hits.push(req.url());
    });
    await enrolPreview(page);
    await login(page, 'nadia');
    await expect(page).toHaveURL(/\/pos/);
    await page.getByLabel(/opening float/i).fill('50');
    await page.getByRole('button', { name: /open shift/i }).click();
    await expect(page.getByText(/new sale|menu/i).first()).toBeVisible({ timeout: 15_000 });
    expect(hits, `Forbidden: ${hits.join(', ')}`).toEqual([]);
  });
});
