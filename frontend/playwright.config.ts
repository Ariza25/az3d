import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5181',
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'mobile-iphone-se',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'mobile-iphone-14',
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'mobile-pixel-7',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev:test',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
