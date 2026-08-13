// @ts-check
const { expect } = require('@playwright/test');
const { TIMEOUT } = require('../config/testConfig');

/**
 * Wait Helper — reusable wait strategies for stable, flake-free tests.
 * Adapted for PrimeReact UI components used in the CartUp Inventory system.
 */

/**
 * Wait for page to reach a stable state.
 * networkIdle is opt-in — only use after form submissions where API responses need to settle.
 * For navigation and clicks, domcontentloaded is sufficient and faster.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @param {{ networkIdle?: boolean }} [options]
 */
async function waitForPageStable(page, timeout = TIMEOUT.NAVIGATION, { networkIdle = false } = {}) {
    await page.waitForLoadState('domcontentloaded', { timeout });
    if (networkIdle) {
        await page.waitForLoadState('networkidle', { timeout }).catch(() => {
            console.log('  [WAIT] networkidle timed out — continuing');
        });
    }
}

/**
 * Wait for a toast/notification containing specific text.
 * Supports PrimeReact Toast (.p-toast) and common notification patterns.
 * @param {import('@playwright/test').Page} page
 * @param {string} text — partial text to match
 * @param {'success' | 'error' | 'any'} [type='any']
 * @param {number} [timeout]
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function waitForToast(page, text, type = 'any', timeout = TIMEOUT.LONG) {
    const selectors = [
        '.p-toast-message',
        '.p-toast',
        '.Toastify__toast',
        '[role="alert"]',
        '.p-message',
    ];

    const toast = page.locator(selectors.join(', ')).filter({ hasText: text }).first();
    await toast.waitFor({ state: 'visible', timeout });
    console.log(`  [TOAST] Found notification: "${text}"`);
    return toast;
}

/**
 * Wait for a data table to finish loading (spinner gone, rows visible).
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
async function waitForTableLoad(page, timeout = TIMEOUT.LONG) {
    const spinner = page.locator('.p-datatable-loading-overlay, .p-progressbar, .loading-spinner, [data-testid="loading"]');
    await spinner.waitFor({ state: 'hidden', timeout }).catch(() => {
        console.log('  [WAIT] No spinner found or already hidden');
    });

    const tableRow = page.locator('table tbody tr, .p-datatable-tbody tr').first();
    await tableRow.waitFor({ state: 'visible', timeout }).catch(() => {
        console.log('  [WAIT] No table rows found — table may be empty');
    });
}

/**
 * Retry an async action up to N times with a delay between attempts.
 * @param {() => Promise<boolean>} fn — returns true on success
 * @param {number} [retries=3]
 * @param {number} [delayMs=1000]
 * @returns {Promise<boolean>}
 */
async function retryAction(fn, retries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await fn();
            if (result) {
                console.log(`  [RETRY] Action succeeded on attempt ${attempt}`);
                return true;
            }
        } catch (err) {
            console.log(`  [RETRY] Attempt ${attempt} failed: ${err.message}`);
        }
        if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    console.log(`  [RETRY] All ${retries} attempts exhausted`);
    return false;
}

/**
 * Wait for a specific element to become visible and stable.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {number} [timeout]
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function waitForElement(page, selector, timeout = TIMEOUT.MEDIUM) {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout });
    return element;
}

/**
 * Wait for URL to contain a specific path segment.
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPattern — glob pattern for URL matching
 * @param {number} [timeout]
 */
async function waitForNavigation(page, urlPattern, timeout = TIMEOUT.NAVIGATION) {
    await page.waitForURL(urlPattern, { timeout });
    await waitForPageStable(page);
}

module.exports = {
    waitForPageStable,
    waitForToast,
    waitForTableLoad,
    retryAction,
    waitForElement,
    waitForNavigation,
};