// @ts-check
const { expect } = require('@playwright/test');
const { TIMEOUT, OTP } = require('../config/testConfig');

/**
 * OTP Helper — handles OTP entry during login flow.
 * The inventory system uses 6 individual digit input fields + a VERIFY button.
 */

/**
 * Wait for the OTP verification screen to appear.
 * @param {import('@playwright/test').Page} page
 */
async function waitForOtpScreen(page) {
    // The OTP form has heading "Verify OTP" and text "Check email for OTP"
    const otpHeading = page.locator('text=Verify OTP');
    await otpHeading.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
    console.log('  [OTP] OTP screen is visible');
}

/**
 * Enter the 6-digit OTP into individual input fields and click VERIFY.
 * @param {import('@playwright/test').Page} page
 * @param {string} [otp] - 6-digit OTP string, defaults to config value
 */
async function enterOtp(page, otp = OTP) {
    console.log(`  [OTP] Entering OTP: ${otp}`);

    const digitInputs = page.locator('input[inputmode="numeric"][maxlength="1"]');

    // Wait for the first input to be visible to ensure form is ready
    await digitInputs.first().waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

    const inputCount = await digitInputs.count();
    console.log(`  [OTP] Found ${inputCount} OTP digit inputs`);

    if (inputCount === 0) {
        // Fallback: try typing the OTP into the first focused/visible input
        await page.keyboard.type(otp, { delay: 100 });
        console.log('  [OTP] Used keyboard.type fallback');
    } else {
        // Fill each digit
        for (let i = 0; i < Math.min(inputCount, otp.length); i++) {
            await digitInputs.nth(i).fill(otp[i]);
        }
        await digitInputs.last().press('Tab');
        console.log(`  [OTP] Filled ${Math.min(inputCount, otp.length)} digit inputs`);
    }

    // Click VERIFY button
    const verifyBtn = page.locator('button[type="submit"]').filter({ hasText: /verify/i });
    await expect(verifyBtn).toBeVisible({ timeout: TIMEOUT.MEDIUM });
    await verifyBtn.click();
    console.log('  [OTP] VERIFY button clicked');
}

/**
 * Complete OTP verification flow: wait for screen, enter OTP.
 * @param {import('@playwright/test').Page} page
 * @param {string} [otp]
 */
async function completeOtpVerification(page, otp = OTP) {
    await waitForOtpScreen(page);
    await enterOtp(page, otp);
    console.log('  [OTP] OTP verification submitted');
}

module.exports = {
    waitForOtpScreen,
    enterOtp,
    completeOtpVerification,
};
