import { expect, test } from '@playwright/test';

test('trusted staff login enters live single-café Sale and Orders without terminal or shift prerequisites', async ({ page }) => {
  const deferredRequests: string[] = [];
  const staff = {
    id: 'staff-e2e', username: 'staff.browser@example.test', role: 'staff', fullName: 'Nora Staff',
    isGlobalManager: false, dualRolePosEnabled: false, selectedProduct: 'pos', assignedBranchIds: [],
  };
  let loggedIn = false;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/terminals/') || path.includes('/shifts/')) deferredRequests.push(path);
  });
  await page.route('**/api/v1/auth/employee/session', (route) => route.fulfill(loggedIn
    ? { status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employee: staff } }) }
    : { status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'EMPLOYEE_SESSION_REQUIRED' }) }));
  await page.route('**/api/v1/auth/employee/login', (route) => {
    loggedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employee: staff, session: {} } }) });
  });
  await page.route('**/api/v1/catalogue', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision: 42, categories: [], items: [] }) }));
  await page.route(/\/api\/v1\/orders\?.*/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

  await page.goto('/employee');
  await page.getByLabel(/username/i).fill('staff.browser@example.test');
  await page.locator('#emp-password').fill('test-only-browser-input');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText(/live · single café/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /new sale/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^orders$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /member|shift|terminal/i })).toHaveCount(0);
  await page.getByRole('button', { name: /^orders$/i }).click();
  await expect(page.getByRole('tablist', { name: /order workload/i })).toBeVisible();
  expect(deferredRequests).toEqual([]);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/unauthorized$/);
});
