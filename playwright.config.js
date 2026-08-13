// @ts-check
require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '**/*.spec.js',
    timeout: 90000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'html',
    use: {
        headless: false,
        slowMo: 0,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 15000,
        navigationTimeout: 30000,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },
});