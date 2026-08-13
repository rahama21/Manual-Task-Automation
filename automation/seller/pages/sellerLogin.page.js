// @ts-check
const { expect } = require('@playwright/test');
const { BASE_URL, TIMEOUT } = require('../../../config/testConfig');

class LoginPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.baseUrl = BASE_URL;

        // Locators
        this.landingLoginBtn = page.locator('button', { hasText: 'Log in' }).first();
        this.mobileInput = page.locator('input[name="mobileOrEmail"]');
        this.passwordInput = page.locator('input[name="password"]');
        this.submitBtn = page.locator('button[type="submit"]:has-text("Log In")');
    }

    /** Navigate to the base URL and wait for stable state. */
    async goto() {
        await this.page.goto(this.baseUrl);
        await this.waitForStable();
    }

    /**
     * Complete the login flow.
     * @param {string} username
     * @param {string} password
     */
    async login(username, password) {
        console.log('\n[LOGIN] STEP 1: Login');

        // --- Landing page Log in button ---
        // Retry landing login button until mobile input appears
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.landingLoginBtn.click();
            const appeared = await this.mobileInput
                .waitFor({ state: 'visible', timeout: 5000 })
                .then(() => true)
                .catch(() => false);
            if (appeared) {
                console.log(`  -> Clicked landing page Log in button (attempt ${attempt})`);
                break;
            }
            console.log(`  -> Login form not appeared, retrying (attempt ${attempt})...`);
        }
        await this.mobileInput.fill(username);
        console.log('  -> Mobile / Email filled');

        // --- Password input ---
        await expect(this.passwordInput).toBeVisible({ timeout: TIMEOUT.LONG });
        await this.passwordInput.fill(password);
        console.log('  -> Password filled');

        // --- Submit button ---
        await expect(this.submitBtn).toBeVisible({ timeout: TIMEOUT.LONG });
        await this.submitBtn.click();
        console.log('  -> Login submitted');
    }

    /** Wait for dashboard redirect after login. */
    async waitForDashboard() {
        // Wait for the URL to leave the auth section entirely
        await this.page.waitForURL(url => !url.href.includes('/auth/'), { timeout: TIMEOUT.LOGIN_REDIRECT });
        await this.waitForStable();
        console.log('  [OK] Dashboard loaded, URL: ' + this.page.url());
    }

    /** Wait for page to reach a stable state. */
    async waitForStable() {
        await this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT.LONG });
    }
}

module.exports = { LoginPage };
