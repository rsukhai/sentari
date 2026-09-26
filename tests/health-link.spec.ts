import { expect, test } from '@playwright/test';

test('головна сторінка містить посилання на стан сервісу', async ({ page }, testInfo) => {
  await page.goto('/');

  const healthLink = page.getByRole('link', { name: 'Стан сервісу' });
  await expect(healthLink).toBeVisible();
  await expect(healthLink).toHaveAttribute('href', '/api/health');

  const screenshotPath = testInfo.outputPath('home-health-link.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('home-health-link', { path: screenshotPath, contentType: 'image/png' });
});
