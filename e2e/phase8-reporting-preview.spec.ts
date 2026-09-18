import { test, expect, type Page } from '@playwright/test';

async function enrolPreview(page: Page) {
  await page.goto('/employee');
  await page.evaluate(() => {
    try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ }
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
}

async function loginAdmin(page: Page) {
  await page.getByRole('button', { name: /siti/i }).click();
  await page.getByLabel(/^pin$/i).fill('4821');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|$)/, { timeout: 15_000 });
}

test('Phase 8 reporting preview stays fixture-only across all reporting surfaces', async ({ page }) => {
  const reportingRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/v1/admin/reporting/')) reportingRequests.push(path);
  });

  await enrolPreview(page);
  await loginAdmin(page);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Executive dashboard/i })).toBeVisible();
  await expect(page.getByText(/UI preview sample metrics/i)).toBeVisible();

  await page.goto('/admin/reports/sales');
  await expect(page.getByRole('heading', { name: /Sales & Performance/i })).toBeVisible();
  await expect(page.getByText(/UI preview sample reporting/i)).toBeVisible();

  await page.goto('/admin/reports/transactions');
  await expect(page.getByRole('heading', { name: /Transaction report/i })).toBeVisible();
  await expect(page.getByText(/UI preview sample transactions/i)).toBeVisible();

  await page.goto('/admin/system/audit');
  await expect(page.getByRole('heading', { name: /Audit log/i })).toBeVisible();
  await expect(page.getByText(/UI preview sample events/i)).toBeVisible();

  expect(reportingRequests, `Unexpected privileged reporting requests: ${reportingRequests.join(', ')}`).toEqual([]);
});
