// @ts-check
const { TIMEOUT } = require('../config/testConfig');

const RETRY = {
    DROPDOWN_ATTEMPTS: 1,
};

/**
 * Resilient dropdown selection. Supports React Select and PrimeReact.
 * @param {import('@playwright/test').Page} page
 * @param {string} label - The label text near the dropdown
 * @param {string} value - The value to select
 */
async function selectDropdown(page, label, value) {
    console.log(`  -> Selecting "${value}" for ${label}`);

    for (let attempt = 1; attempt <= RETRY.DROPDOWN_ATTEMPTS; attempt++) {
        try {
            // --- Strategy A: React Select (input[role="combobox"]) ---
            const labelLoc = page
                .locator('label, p, span')
                .filter({ hasText: new RegExp(`^${label}`, 'i') })
                .first();

            if (await labelLoc.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                // Walk up 1-3 ancestor divs to find a combobox input
                let combobox = null;
                for (let level = 1; level <= 3; level++) {
                    const container = labelLoc.locator(`xpath=ancestor::div[${level}]`);
                    const cb = container.locator('input[role="combobox"]').first();
                    if (await cb.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                        combobox = cb;
                        break;
                    }
                }

                if (combobox) {
                    console.log(`  -> Found React Select combobox for ${label}`);
                    await combobox.click();
                    await combobox.fill(value);
                    // Wait for React Select options to render (client-side, no network)
                    await page.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

                    // Look for matching option in the open menu via role or class
                    const menuOption = page
                        .locator('[role="option"], [class*="menu"] [class*="option"], [id*="react-select"][id*="option"]')
                        .filter({ hasText: new RegExp(value, 'i') })
                        .first();

                    if (await menuOption.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false)) {
                        await menuOption.click();
                        console.log(`  [OK] Selected "${value}" for ${label} (React Select)`);
                        return;
                    }

                    // Keyboard fallback: Enter
                    console.log(`  -> Menu option not found via locator, trying keyboard...`);
                    await page.keyboard.press('Enter');

                    // Verify a value was selected
                    const selectedText = await combobox
                        .locator('xpath=ancestor::div[3]')
                        .locator('[class*="singleValue"], [class*="single-value"]')
                        .innerText()
                        .catch(() => '');
                    if (selectedText) {
                        console.log(`  [OK] Selected "${selectedText}" for ${label} (keyboard)`);
                        return;
                    }

                    // ArrowDown + Enter fallback
                    await combobox.click();
                    await combobox.fill(value);
                    await page.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
                    await page.keyboard.press('ArrowDown');
                    await page.waitForTimeout(300);
                    await page.keyboard.press('Enter');
                    console.log(`  [OK] Selected for ${label} (ArrowDown+Enter fallback)`);
                    return;
                }
            }

            // --- Strategy B: PrimeReact .p-dropdown ---
            let trigger = null;

            if (await labelLoc.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                const parentDropdown = labelLoc.locator('xpath=ancestor::div[1]').locator('.p-dropdown').first();
                if (await parentDropdown.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                    trigger = parentDropdown;
                }

                if (!trigger) {
                    const siblingDropdown = labelLoc.locator('xpath=parent::*').locator('.p-dropdown').first();
                    if (await siblingDropdown.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                        trigger = siblingDropdown;
                    }
                }
            }

            if (trigger) {
                await trigger.click({ force: true });

                const panel = page.locator('.p-dropdown-panel:visible').first();
                if (await panel.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false)) {
                    const filterInput = panel.locator('input.p-dropdown-filter').first();
                    if (await filterInput.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                        await filterInput.fill(value);
                        await page.waitForLoadState('networkidle', { timeout: TIMEOUT.LONG });
                    }

                    const item = panel
                        .locator('.p-dropdown-item, li[role="option"]')
                        .filter({ hasText: new RegExp(value, 'i') })
                        .first();
                    if (await item.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                        await item.click({ force: true });
                        console.log(`  [OK] Selected "${value}" for ${label} (PrimeReact)`);
                        return;
                    }
                }
            }

            // --- Strategy C: Positional click fallback ---
            if (await labelLoc.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
                console.log(`  -> Using positional click for ${label}`);
                const box = await labelLoc.boundingBox();
                if (box) {
                    await page.mouse.click(box.x + box.width + 60, box.y + box.height / 2);
                    await page.waitForLoadState('networkidle', { timeout: TIMEOUT.LONG });
                    await page.keyboard.type(value);
                    await page.waitForLoadState('networkidle', { timeout: TIMEOUT.LONG });
                    await page.keyboard.press('Enter');
                    console.log(`  [OK] Finished selection for ${label} (positional click)`);
                    return;
                }
            }
        } catch (e) {
            console.log(`  [WARN] Attempt ${attempt} for ${label} failed: ${/** @type {Error} */ (e).message}`);
        }
        await page.waitForTimeout(TIMEOUT.SHORT);
    }

    console.error(`  [ERR] Failed to select "${value}" for ${label} after ${RETRY.DROPDOWN_ATTEMPTS} attempts`);
    await page.screenshot({ path: `failure-select-${label}.png`, fullPage: true }).catch(() => { });
}

module.exports = { selectDropdown };
