import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;
const isCI = !!process.env['CI'];

/**
 * Lokal kann statt des von Playwright installierten Chromiums ein vorhandenes verwendet werden,
 * z.B. PW_CHROMIUM_PATH=/usr/bin/chromium npm run e2e
 */
const executablePath = process.env['PW_CHROMIUM_PATH'] || undefined;

export default defineConfig({
    testDir: './e2e',
    // Eigene Endung, damit Vitest (*.spec.ts) die E2E-Tests nicht aufgreift
    testMatch: '**/*.e2e.ts',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    // Jeder Test lädt die App vom Entwicklungsserver, mehr parallele Browser bremsen ihn nur aus
    workers: Number(process.env['PW_WORKERS']) || 2,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: isCI
        ? [['github'], ['list'], ['html', { open: 'never' }], ['./e2e/summary-reporter.ts']]
        : [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: `http://localhost:${PORT}`,
        locale: 'de-AT',
        timezoneId: 'Europe/Vienna',
        viewport: { width: 1600, height: 1000 },
        acceptDownloads: true,
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1600, height: 1000 },
                launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : {}
            }
        }
    ],

    // Entwicklungs-Konfiguration: verwendet die FakeSyncApi statt des lokalen MAT Sync-Services
    webServer: {
        command: `npx ng serve --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe'
    }
});
