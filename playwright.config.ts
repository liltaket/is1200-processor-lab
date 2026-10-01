import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:4180', headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit-tablet', grep: /@tablet/, use: { ...devices['iPad Mini'], browserName: 'webkit' } },
  ],
  webServer: process.env.TEST_BASE_URL ? undefined : { command: 'npm run preview -- --port 4180 --strictPort', url: 'http://127.0.0.1:4180', reuseExistingServer: false },
});
