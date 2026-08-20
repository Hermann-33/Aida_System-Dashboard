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

  test('preview Manager keeps Admin routes mounted without privileged-session loops', async ({ page }) => {
    const privilegedRequests: string[] = [];
    const responseStatuses = new Map<string, number>();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path === '/api/v1/admin/members' || path === '/api/v1/admin/catalogue') {
        privilegedRequests.push(path);
      }
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/api/v1/')) responseStatuses.set(path, response.status());
    });

    await enrolPreview(page);
    await login(page, 'siti');
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/reports/members');
    await expect(page).toHaveURL(/\/admin\/reports\/members$/);
    await expect(page.getByText(/live member data requires a real aida admin session/i)).toBeVisible();
    await page.waitForTimeout(750);
    await expect(page).toHaveURL(/\/admin\/reports\/members$/);

    await page.goto('/admin/catalogue/menu');
    await expect(page).toHaveURL(/\/admin\/catalogue\/menu$/);
    await expect(page.getByText(/live published catalogue in read-only mode/i)).toBeVisible();
    await expect(page.getByText('Latte').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /add item/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /edit/i })).toHaveCount(0);
    await page.waitForTimeout(750);
    await expect(page).toHaveURL(/\/admin\/catalogue\/menu$/);

    expect(privilegedRequests).toEqual([]);
    expect(responseStatuses.get('/api/v1/catalogue')).toBe(200);
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

  test('scheduled operations are separated by workload and remain usable on a narrow counter viewport', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const base = {
      source: 'customer', customerUserId: 'customer-1', memberId: 'member-1', fulfillmentType: 'scheduled',
      serverNow: '2026-08-20T14:00:00Z', statusVersion: 3, currency: 'MYR', pricingVersion: 1,
      subtotalSen: 1200, totalSen: 1200, createdAt: '2026-08-20T12:00:00Z', updatedAt: '2026-08-20T12:00:00Z',
      statusUpdatedAt: '2026-08-20T12:00:00Z', preparingAt: null, readyAt: null, completedAt: null, cancelledAt: null,
      lines: [{ id: 'line-1', lineNumber: 1, itemId: 'item-1', sku: 'CF-LAT', name: 'Latte', prepRoute: 'bar', basePriceSen: 1200, variant: null, addOns: [], addOnTotalSen: 0, unitPriceSen: 1200, quantity: 1, lineTotalSen: 1200, note: null }],
    };
    const orders = [
      { ...base, id: 'overdue', orderNumber: 100009, status: 'scheduled', scheduleState: 'overdue', prepareAt: '2026-08-20T13:30:00Z', requestedPickupAt: '2026-08-20T13:45:00Z' },
      { ...base, id: 'due', orderNumber: 100010, status: 'scheduled', scheduleState: 'due', prepareAt: '2026-08-20T13:55:00Z', requestedPickupAt: '2026-08-20T14:10:00Z' },
      { ...base, id: 'future', orderNumber: 100011, status: 'scheduled', scheduleState: 'future', prepareAt: '2026-08-20T15:00:00Z', requestedPickupAt: '2026-08-20T15:15:00Z' },
      { ...base, id: 'ready', orderNumber: 100012, fulfillmentType: 'asap', status: 'ready', scheduleState: null, prepareAt: null, requestedPickupAt: null, readyAt: '2026-08-20T13:50:00Z' },
      { ...base, id: 'complete', orderNumber: 100013, fulfillmentType: 'asap', status: 'completed', scheduleState: null, prepareAt: null, requestedPickupAt: null, completedAt: '2026-08-20T13:40:00Z' },
    ];
    let statusPayload: Record<string, unknown> | null = null;
    await page.route('**/api/v1/catalogue', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision: 42, categories: [], items: [] }) }));
    await page.route(/\/api\/v1\/orders\?.*/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orders) }));
    await page.route('**/api/v1/orders/status', async (route) => {
      statusPayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...orders[0], status: 'preparing', scheduleState: null, prepareAt: null, statusVersion: 4, preparingAt: '2026-08-20T14:00:00Z' }) });
    });
    await enrolPreview(page);
    await login(page, 'nadia');
    await page.getByLabel(/opening float/i).fill('50');
    await page.getByRole('button', { name: /open shift/i }).click();
    await page.getByRole('button', { name: /^orders$/i }).click();
    await expect(page.getByText('#100009')).toBeVisible();
    await expect(page.getByText('Overdue')).toBeVisible();
    await expect(page.getByText('#100011')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('orders-active-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: /start preparing/i }).first().click();
    expect(statusPayload).toEqual({ orderId: 'overdue', toStatus: 'preparing', expectedVersion: 3 });
    await page.getByRole('tab', { name: /scheduled/i }).click();
    await expect(page.getByText('#100011')).toBeVisible();
    await page.getByRole('tab', { name: /ready/i }).click();
    await expect(page.getByText('#100012')).toBeVisible();
    await page.getByRole('tab', { name: /history/i }).click();
    await expect(page.getByText('#100013')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('tablist', { name: /order workload/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('orders-history-mobile.png'), fullPage: true });
    expect(consoleErrors).toEqual([]);
  });

  test('authoritative POS quote, placement and live status UI use the same-origin order contract', async ({ page }) => {
    const itemId = '11111111-1111-4111-8111-111111111111';
    const order = {
      id: '44444444-4444-4444-8444-444444444444', orderNumber: 100031, source: 'pos',
      customerUserId: null, memberId: null, fulfillmentType: 'asap', requestedPickupAt: null,
      prepareAt: null, serverNow: '2026-08-14T00:00:00Z', scheduleState: null,
      status: 'confirmed', statusVersion: 1, currency: 'MYR', pricingVersion: 1,
      subtotalSen: 1450, totalSen: 1450, createdAt: '2026-08-14T00:00:00Z',
      updatedAt: '2026-08-14T00:00:00Z', statusUpdatedAt: '2026-08-14T00:00:00Z',
      preparingAt: null, readyAt: null, completedAt: null, cancelledAt: null,
      lines: [{
        id: 'line-1', lineNumber: 1, itemId, sku: 'CF-LAT', name: 'Latte', prepRoute: 'bar',
        basePriceSen: 1450, variant: null, addOns: [], addOnTotalSen: 0, unitPriceSen: 1450,
        quantity: 1, lineTotalSen: 1450, note: null,
      }],
    };
    let quotePayload: Record<string, unknown> | null = null;
    let statusPayload: Record<string, unknown> | null = null;

    await page.route('**/api/v1/catalogue', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        revision: 15,
        categories: [{ id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 1 }],
        items: [{
          id: itemId, categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'CF-LAT', kind: 'product',
          name: 'Latte', description: '', basePriceSen: 1, isAvailable: true, isPublished: true,
          isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
          prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: [], variants: [],
        }],
      }),
    }));
    await page.route('**/api/v1/orders/policy', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        serverNow: '2026-08-14T00:00:00Z', timezone: 'Asia/Kuala_Lumpur', scheduleEnabled: true,
        minimumLeadMinutes: 15, preparationLeadMinutes: 15, slotIntervalMinutes: 15, maximumAdvanceDays: 7,
      }),
    }));
    await page.route('**/api/v1/orders/quote', async (route) => {
      quotePayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        pricingVersion: 1, currency: 'MYR', subtotalSen: 1450, totalSen: 1450,
        fulfillmentType: 'asap', requestedPickupAt: null, serverNow: '2026-08-14T00:00:00Z',
        schedulePolicy: { timezone: 'Asia/Kuala_Lumpur', scheduleEnabled: true, minimumLeadMinutes: 15, preparationLeadMinutes: 15, slotIntervalMinutes: 15, maximumAdvanceDays: 7 },
        lines: order.lines,
      }) });
    });
    await page.route('**/api/v1/orders/place', (route) => route.fulfill({
      status: 201, contentType: 'application/json', body: JSON.stringify(order),
    }));
    await page.route(/\/api\/v1\/orders\?.*/, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([order]),
    }));
    await page.route('**/api/v1/orders/detail**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(order),
    }));
    await page.route('**/api/v1/orders/status', async (route) => {
      statusPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...order, status: 'preparing', statusVersion: 2 }),
      });
    });

    await enrolPreview(page);
    await login(page, 'nadia');
    const openShift = page.getByRole('button', { name: /^open shift$/i });
    await expect(openShift).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/opening float/i).fill('50');
    await openShift.click();
    await expect(page.getByRole('button', { name: /latte/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /latte/i }).click();
    await page.getByRole('button', { name: /add to order/i }).click();
    await page.getByRole('button', { name: /review & place/i }).click();
    await page.getByRole('button', { name: /review authoritative total/i }).click();
    await expect(page.getByText('RM 14.50')).toBeVisible();
    expect(JSON.stringify(quotePayload)).not.toMatch(/price|total|name|member|status/i);
    await page.getByRole('button', { name: /place order/i }).click();
    await expect(page.getByRole('heading', { name: /order #100031/i })).toBeVisible();
    await expect(page.getByText(/pay at counter.*unpaid/i)).toBeVisible();

    await page.getByRole('button', { name: /^orders$/i }).click();
    await expect(page.getByText('#100031', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /start preparing/i }).click();
    await expect(page.getByRole('status')).toContainText(/now preparing/i);
    expect(statusPayload).toEqual({ orderId: order.id, toStatus: 'preparing', expectedVersion: 1 });
  });
});
