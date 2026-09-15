import { expect, test } from '@playwright/test';

const staff = {
  id: 'staff-e2e',
  username: 'staff.browser@example.test',
  role: 'staff',
  fullName: 'Nora Staff',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['branch-main'],
};

const terminalLocation = {
  terminalId: 'terminal-main',
  terminalCode: 'POS-MAIN-01',
  branchId: 'branch-main',
  branchCode: 'BR-MAIN',
  branchName: 'Main Café',
  salesPointId: 'sales-main',
  salesPointCode: 'SP-MAIN',
  salesPointName: 'Main Counter',
};

const openShift = {
  id: 'shift-live-1',
  status: 'open',
  statusVersion: 3,
  branchId: 'branch-main',
  salesPointId: 'sales-main',
  terminalId: 'terminal-main',
  openedByUserId: 'staff-e2e',
  operatorUserId: 'staff-e2e',
  canOperate: true,
  openingFloatSen: 10000,
  expectedCashSen: 10000,
  cashInSen: 0,
  cashOutSen: 0,
  cashSalesSen: 0,
  closingActualCashSen: null,
  cashVarianceSen: null,
  openedAt: '2026-09-15T00:00:00.000Z',
  lockedAt: null,
  lastResumedAt: null,
  closedAt: null,
  closeNotes: null,
  handoverNotes: null,
  closedByUserId: null,
  approvedByUserId: null,
  approvedAt: null,
};

async function mountLiveStaffRoutes(page: import('@playwright/test').Page) {
  let loggedIn = false;
  const authorityRequests: string[] = [];

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/terminals/status' || path === '/api/v1/shifts/current') {
      authorityRequests.push(path);
    }
  });

  await page.route('**/api/v1/auth/employee/session', (route) => route.fulfill(loggedIn
    ? { status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employee: staff } }) }
    : { status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'EMPLOYEE_SESSION_REQUIRED' }) }));
  await page.route('**/api/v1/auth/employee/login', (route) => {
    loggedIn = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { employee: staff, session: {} } }),
    });
  });
  await page.route('**/api/v1/terminals/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { enrolled: true, location: terminalLocation } }),
  }));
  await page.route('**/api/v1/shifts/current', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: openShift }),
  }));
  await page.route('**/api/v1/catalogue', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ revision: 42, categories: [], items: [] }),
  }));
  await page.route(/\/api\/v1\/orders\?.*/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));

  return authorityRequests;
}

test('trusted staff login reaches live POS only after terminal and open-shift authority resolve', async ({ page }) => {
  const authorityRequests = await mountLiveStaffRoutes(page);

  await page.goto('/employee');
  await page.getByLabel(/username/i).fill('staff.browser@example.test');
  await page.locator('#emp-password').fill('test-only-browser-input');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText(/shift open/i)).toBeVisible();
  await expect(page.getByText(/live authority/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /new sale/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^orders$/i })).toBeVisible();

  expect(authorityRequests.filter((path) => path === '/api/v1/terminals/status').length).toBeGreaterThanOrEqual(1);
  expect(authorityRequests).toContain('/api/v1/shifts/current');

  await page.getByRole('button', { name: /^orders$/i }).click();
  await expect(page.getByRole('tablist', { name: /order workload/i })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test('live POS fails closed when the trusted terminal has no open shift', async ({ page }) => {
  let loggedIn = false;
  await page.route('**/api/v1/auth/employee/session', (route) => route.fulfill(loggedIn
    ? { status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employee: staff } }) }
    : { status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'EMPLOYEE_SESSION_REQUIRED' }) }));
  await page.route('**/api/v1/auth/employee/login', (route) => {
    loggedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employee: staff, session: {} } }) });
  });
  await page.route('**/api/v1/terminals/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { enrolled: true, location: terminalLocation } }),
  }));
  await page.route('**/api/v1/shifts/current', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: null }),
  }));

  await page.goto('/employee');
  await page.getByLabel(/username/i).fill('staff.browser@example.test');
  await page.locator('#emp-password').fill('test-only-browser-input');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('heading', { name: /open shift/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /new sale/i })).toHaveCount(0);
});
