// @ts-check
const { expect } = require('@playwright/test');
const { TIMEOUT, OTP, PATHS, MENU } = require('../../../config/testConfig');
const { completeOtpVerification } = require('../../../utils/otpHelper');
const { waitForPageStable, waitForToast, waitForTableLoad } = require('../../../utils/waitHelper');

// --- Login Page -------------------------------------------------------------
class LoginPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;
        this.usernameInput = page.locator('input[name="username"]');
        this.passwordInput = page.locator('input[name="password"]');
        this.loginBtn = page.locator('button[type="submit"]').filter({ hasText: /^login$/i });
        this.otpInputs = page.locator('input[inputmode="numeric"][maxlength="1"]');
        this.verifyBtn = page.locator('button[type="submit"]').filter({ hasText: /^verify$/i });
    }

    async goto() {
        await this.page.goto(PATHS.LOGIN);
        await this.usernameInput.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
        console.log('[LOGIN] Navigated to login page');
    }

    async login(username, password) {
        console.log('\n[LOGIN] STEP 1: Entering credentials');
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginBtn.click();
        console.log('  -> Login button clicked');
    }

    async enterOtp(otp = OTP) {
        console.log('\n[LOGIN] STEP 2: OTP Verification');
        await completeOtpVerification(this.page, otp);
    }

    async waitForDashboard() {
        // App lands on root URL after login, not /dashboard
        await this.page.waitForFunction(
            () => !window.location.pathname.includes('/auth'),
            { timeout: TIMEOUT.LOGIN_REDIRECT }
        );
        await this.page.locator('.ps-sidebar-container').waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
        await waitForPageStable(this.page);
        console.log('  [OK] Post-login page loaded, URL: ' + this.page.url());
    }
}

// --- Outbound Approval Page -------------------------------------------------
class OutboundApprovalPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;

        // Navigation strategy:
        // - No role="menuitem", no unique IDs, all items share same data-testid
        // - Scoped to .ps-sidebar-container to avoid matching breadcrumbs/page titles
        // - filter({ hasText: /^exact$/ }) removes dependency on PrimeReact CSS classes
        // - MENU labels are business terms, stable across UI library upgrades
        // MENU labels sourced from testConfig — single place to update if text ever changes
        const nav = page.locator('.ps-sidebar-container');
        this.operationMenu = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.OPERATION}$`) });
        this.outboundSubmenu = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.OUTBOUND}$`) });
        this.outboundApprovalLink = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.OUTBOUND_APPROVAL}$`) });

        // --- Tabs ---
        // Tabs: <a role="presentation"> disqualifies getByRole('link') — returns 0 matches.
        // Scoped to ul.p-tabmenu-nav to avoid matching other links with same text.
        // filter() removes PrimeReact class dependency vs the previous :has(.p-menuitem-text) pattern.
        this.tabNav = page.locator('ul.p-tabmenu-nav');
        this.pendingTab = this.tabNav.locator('a').filter({ hasText: /^Pending$/ });
        this.approvedTab = this.tabNav.locator('a').filter({ hasText: /^Approved$/ });

        // --- Search ---
        // name="orderNo" is stable and unique per inspected HTML
        this.searchInput = page.locator('input[name="orderNo"]');
        // Search trigger: rendered as <div class="flex">, not a <button>.
        // getByRole('button') returns 0 matches. Text-scoped div is the only option.
        // Search triggered via Enter key on input — searchBtn removed
        // type="submit" button is in a sibling div, not reachable by parent traversal

        // --- Checkbox + Bulk Approve ---
        // Row checkbox: scoped to tbody to avoid header checkbox
        this.firstRowCheckbox = page.locator('tbody tr').first().locator('[data-pc-section="checkbox"]');
        this.bulkApproveBtn = page.getByRole('button', { name: /bulk approve/i });
        // Confirmation Yes button
        this.confirmYesBtn = page.locator('button[aria-label="Yes"]');
        // Scoped to Pick List dialog — avoids strict mode violation when Approval Confirmation
        // dialog is still in DOM alongside the Pick List print dialog
        this.pickListCloseBtn = page.getByRole('dialog', { name: 'Pick List' }).getByLabel('Close');

        // DO link and DO code are resolved per-method using order number scope
        // avoids stale first-row assumption if sort order changes
    }

    // --- State detection ----------------------------------------------------

    async isOrderInCurrentTab(orderNumber) {
        // Returns true if the order row is visible after search, false if no results
        // Uses waitFor with SHORT timeout — gives table time to render after search
        // isVisible() alone is instantaneous and misses rows still loading
        const row = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) })
            .first();
        try {
            await row.waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
            return true;
        } catch {
            return false;
        }
    }

    // --- Navigation ---------------------------------------------------------

    async navigateToOutboundApproval() {
        console.log('\n[NAV] Navigating to Outbound Order Approval');

        // Step 1: Click Operation — wait for it to be visible and stable first
        await this.operationMenu.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
        await this.operationMenu.scrollIntoViewIfNeeded();
        await this.operationMenu.click();
        console.log('  -> Operation menu clicked');

        // Step 2: Deterministic wait — assert submenu is visible before clicking
        // avoids arbitrary waitForTimeout which is either too short or wastes time
        await expect(this.outboundSubmenu).toBeVisible({ timeout: TIMEOUT.MEDIUM });
        await this.outboundSubmenu.click();
        console.log('  -> Outbound submenu clicked');

        // Step 3: Same pattern for leaf item
        await expect(this.outboundApprovalLink).toBeVisible({ timeout: TIMEOUT.MEDIUM });
        await this.outboundApprovalLink.click();
        console.log('  -> Outbound Order Approval clicked');

        // Step 4: Confirm we landed on the right page by waiting for the URL
        await this.page.waitForURL('**/order/delivery/approval**', { timeout: TIMEOUT.NAVIGATION });
        await waitForPageStable(this.page);
        await waitForTableLoad(this.page);
        console.log('  [OK] Outbound Order Approval page loaded');
    }

    // --- Tabs ---------------------------------------------------------------

    async switchToPendingTab() {
        console.log('\n[TAB] Switching to Pending tab');
        await this.pendingTab.click();
        // Wait for active tab class — same pattern as switchToApprovedTab
        const activeTab = this.tabNav.locator('li.p-highlight a').filter({ hasText: /^Pending$/ });
        await activeTab.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await waitForTableLoad(this.page);
        console.log('  [OK] Pending tab active');
    }

    async switchToApprovedTab() {
        console.log('\n[TAB] Switching to Approved tab');
        await this.approvedTab.click();
        // Wait for the tab to become active — p-highlight is PrimeReact's active tab class
        // Prevents search running before tab switch completes
        const activeTab = this.tabNav.locator('li.p-highlight a').filter({ hasText: /^Approved$/ });
        await activeTab.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await waitForTableLoad(this.page);
        console.log('  [OK] Approved tab active');
    }

    // --- Search -------------------------------------------------------------

    async waitForOrderInApprovedTab(orderNumber, { timeout = 15000 } = {}) {
        // expect.poll retries until row appears or timeout — cleaner than manual loop
        // Re-searches on each poll to trigger fresh table results
        console.log(`\n[WAIT] Polling Approved tab for order: ${orderNumber}`);
        await expect.poll(async () => {
            await this.searchOrder(orderNumber);
            const row = this.page
                .locator('tbody tr')
                .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) });
            return await row.count();
        }, {
            timeout,
            intervals: [1500, 2000, 3000],
            message: `Order ${orderNumber} not found in Approved tab after ${timeout}ms`
        }).toBeGreaterThan(0);
        console.log(`  [OK] Order found in Approved tab`);
    }

    async searchOrder(orderNumber) {
        console.log(`\n[SEARCH] Searching for order: ${orderNumber}`);
        await this.searchInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.searchInput.fill('');
        await this.searchInput.fill(orderNumber);
        // Press Enter — type="submit" button is a sibling, not accessible via parent traversal
        // Enter key submission is equivalent and immune to DOM structure changes
        await this.searchInput.press('Enter');
        await waitForTableLoad(this.page);
        console.log(`  [OK] Search submitted for: ${orderNumber}`);
    }

    async getDOCodeFromRow(orderNumber) {
        // Read DO code from the row in whatever tab is currently active
        // DO link is a span with DO_ prefix — confirmed from earlier HTML
        const row = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) })
            .first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const doSpan = row.locator('span').filter({ hasText: /^DO_/ });
        const text = await doSpan.textContent();
        console.log(`  [INFO] DO code from row: ${text?.trim()}`);
        return text?.trim() ?? '';
    }

    // --- Checkbox + Bulk Approve ----------------------------------------

    async selectOrderCheckbox(orderNumber) {
        console.log(`\n[CHECKBOX] Selecting checkbox for order: ${orderNumber}`);
        // filter({ has: td }) scopes match to a cell — prevents false match if orderNumber
        // appears in another column (e.g. customer ID). .first() guards against pagination
        // showing the same order on multiple pages simultaneously.
        const row = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) })
            .first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        // [data-pc-section="checkbox"] is stable — avoids role="checkbox" which PrimeReact
        // sometimes omits on the wrapper div vs the hidden input inside it
        const checkbox = row.locator('[data-pc-section="checkbox"]');
        await checkbox.click();
        console.log('  [OK] Checkbox selected');
    }

    async clickBulkApprove() {
        console.log('\n[ACTION] Clicking Bulk Approve');
        await this.bulkApproveBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.bulkApproveBtn.click();
        console.log('  -> Bulk Approve clicked');

        // Confirm the approval
        await this.confirmYesBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.confirmYesBtn.click();
        console.log('  -> Confirmation Yes clicked');

        await waitForToast(this.page, 'success');
        console.log('  [OK] Bulk approval successful');

        // Close the Pick List print dialog — scoped by dialog name to avoid ambiguity
        await this.pickListCloseBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.pickListCloseBtn.click();
        console.log('  [OK] Pick List dialog closed');
    }

    // --- DO hyperlink -------------------------------------------------------

    async getDOCode(orderNumber) {
        // Approved tab rows may not contain orderNumber in a td — search narrows to one result
        // Try scoping to order number cell first; fall back to first row with a DO_ span
        const byOrderRow = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) })
            .first();
        const orderRowVisible = await byOrderRow.isVisible().catch(() => false);

        const row = orderRowVisible
            ? byOrderRow
            : this.page.locator('tbody tr').filter({ has: this.page.locator('span').filter({ hasText: /^DO_/ }) }).first();

        await row.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
        const span = row.locator('span').filter({ hasText: /^DO_/ });
        const doCode = (await span.textContent())?.trim() ?? '';
        console.log(`  [INFO] DO code from row: ${doCode}`);
        return doCode;
    }

    async clickDOLink(orderNumber) {
        console.log('\n[LINK] Clicking DO hyperlink');
        // Same row scope as getDOCode — filter by order number cell
        const row = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${orderNumber}")`) })
            .first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const span = row.locator('span').filter({ hasText: /^DO_/ });
        await span.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await span.click();
        await waitForPageStable(this.page);
        console.log('  [OK] DO link clicked');
    }
}


// --- Packing / Scan Page (opens in new tab after clicking DO link) ----------
class PackingScanPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;
        // React Select: [id^='react-select'][id$='-input'] matches any react-select input
        // regardless of index (react-select-2, react-select-3, etc.) — stable across builds
        // css-nbmjvw-control is a CSS-in-JS generated class — changes every build
        this.batchDropdown = page.locator('[id^="react-select"][id$="-input"]').first();
        this.batchDropdownControl = this.batchDropdown.locator('../..');
        // UIN input confirmed from HTML: id="uin-0-0", placeholder="UIN"
        this.uinInput = page.locator('#uin-0-0');  // confirmed: id='uin-{skuIndex}-0'
        // Qty counter confirmed from HTML: placeholder="Qty", type="number", value increments per scan
        this.scannedQtyInput = page.locator('input[placeholder="Qty"]').first();
    }

    async getPackagingCode() {
        // Returns the packaging code captured from the modal during addPackageWithMaterial()
        // _lastPackagingCode is set before the modal is closed
        if (this._lastPackagingCode) {
            console.log(`  [INFO] Packaging code: ${this._lastPackagingCode}`);
            return this._lastPackagingCode;
        }
        console.log(`  [WARN] Packaging code not found in cached value`);
        return '';
    }

    async waitForPage() {
        await this.page.waitForLoadState('domcontentloaded');
        await waitForPageStable(this.page);
        console.log('\n[PACK] Packing page loaded, URL: ' + this.page.url());
    }

    async selectFirstBatch() {
        // Legacy single-row method — delegates to selectBatchForRow(0)
        await this.selectBatchForRow(0);
    }

    async selectBatchForRow(rowIndex) {
        console.log(`\n[PACK] Selecting batch for row ${rowIndex}`);
        // Each row has its own react-select input: react-select-2 (row0), react-select-3 (row1), etc.
        // The batch dropdowns start at react-select-2-input — rowIndex 0 = nth(0) of batch inputs
        // Exclude UIN inputs (id="uin-N-0") by filtering to only react-select inputs
        const batchInput = this.page
            .locator('[id^="react-select"][id$="-input"]')
            .nth(rowIndex);
        await batchInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await batchInput.click();
        const firstOption = this.page.locator('[class*="-option"]').first();
        await firstOption.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const batchText = await firstOption.textContent();
        await firstOption.click();
        console.log(`  [OK] Row ${rowIndex} batch selected: ${batchText?.trim()}`);
    }

    async checkRowCheckbox(rowIndex) {
        // Confirmed from HTML: plain <input type="checkbox"> inside div.flex.justify-content-center
        // No data-pc-section — this is a plain HTML checkbox, not PrimeReact component
        // Each SKU occupies one tbody tr — nth(rowIndex) targets correct row
        const row = this.page.locator('table tbody tr').nth(rowIndex);
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const checkbox = row.locator('input[type="checkbox"]').first();
        const isChecked = await checkbox.isChecked().catch(() => false);
        if (!isChecked) {
            await checkbox.click();
            console.log(`  [OK] Row ${rowIndex} checkbox checked`);
        } else {
            console.log(`  [INFO] Row ${rowIndex} checkbox already checked`);
        }
    }

    async addPackageWithMaterial(materialQty = 1) {
        console.log('\n[PACK] Clicking Add Package');
        // Confirmed HTML: aria-label="Add Package"
        const addPackageBtn = this.page.locator('button[aria-label="Add Package"]');
        await addPackageBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await addPackageBtn.click();
        console.log('  -> Add Package clicked');

        // Click Material tab/button
        const materialBtn = this.page.locator('button span.p-button-label:text-is("Material"), button:has(span.p-button-label:text-is("Material"))').first();
        await materialBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await materialBtn.click();
        console.log('  -> Material tab clicked');

        // Confirmed from HTML: qty and react-select are siblings under div.flex.flex-row.border-round-md
        // qty path: input → div.flex.flex-column → div.col-2 → div.flex.flex-row (shared container)
        // xpath=../../.. from qty input reaches the shared flex-row, then find react-select within it
        const materialFormRow = this.page
            .locator('input[name*="orderPackagingMaterials"][name*="quantity"]')
            .locator('xpath=../../..');  // input → flex-column → col-2 → flex-row
        const materialInput = materialFormRow.locator('[id^="react-select"][id$="-input"]');
        await materialInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await materialInput.click();

        // Select first option from open dropdown
        const firstOption = this.page.locator('[class*="-option"]').first();
        await firstOption.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const optionText = await firstOption.textContent();
        await firstOption.click();
        console.log(`  -> Material selected: ${optionText?.trim()}`);

        // Confirmed from HTML: name="packages[0].orderPackagingMaterials[0].quantity"
        const qtyInput = this.page.locator('input[name*="orderPackagingMaterials"][name*="quantity"]');
        await qtyInput.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
        await qtyInput.fill(String(materialQty));
        console.log(`  -> Quantity set to: ${materialQty}`);

        // Click Submit button
        const submitBtn = this.page.getByRole('button', { name: 'Submit' });
        await submitBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await submitBtn.click();
        console.log('  -> Submit clicked');

        // Confirmed from HTML: packaging code in <span class="...font-semibold">WH-BAD-xxx</span>
        // jsx-* class is a CSS hash — unstable. Use font-semibold + text content filter.
        const closeBtn = this.page.locator('button[aria-label="Close"][data-pc-section="closebutton"]');
        await closeBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const codeSpan = this.page.locator('span.font-semibold').filter({ hasText: /^WH-/ }).first();
        const codeText = await codeSpan.textContent().catch(() => '');
        this._lastPackagingCode = codeText?.trim() ?? '';
        if (!this._lastPackagingCode) {
            throw new Error('Packaging code not captured — span.font-semibold with WH- prefix not found in modal');
        }
        console.log(`  [INFO] Packaging code from modal: ${this._lastPackagingCode}`);

        await closeBtn.click();
        console.log('  [OK] Package submitted and modal closed');
    }

    async scanUINMultipleTimes(uin, qty, skuIndex = 0) {
        // skuIndex maps to id="uin-{skuIndex}-0" — confirmed from HTML
        // Each Enter press increments the qty counter for that row
        console.log(`\n[PACK] Scanning UIN "${uin}" x${qty} (row ${skuIndex})`);

        const uinInput = this.page.locator(`#uin-${skuIndex}-0`);
        const qtyInput = this.page.locator('input[placeholder="Qty"]').nth(skuIndex);

        await uinInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

        for (let i = 1; i <= qty; i++) {
            const before = parseInt(await qtyInput.inputValue(), 10) || 0;

            // Control+A before fill — more reliable than selectText() for clearing
            // Prevents concatenation when input has residual value from previous run/scan
            await uinInput.click();
            await uinInput.press('Control+a');
            await uinInput.fill(uin);
            await uinInput.press('Enter');

            await expect.poll(
                async () => parseInt(await qtyInput.inputValue(), 10),
                { timeout: TIMEOUT.MEDIUM, intervals: [200, 500, 1000] }
            ).toBe(before + 1);

            console.log(`  [${i}/${qty}] row ${skuIndex} scanned, qty: ${before + 1}`);
        }
        console.log(`  [OK] Row ${skuIndex} — all ${qty} scans complete`);
    }

    async scanAllSKUs(skus) {
        // skus: [{ uin: string, qty: number }, ...]
        // For each row: check checkbox → select batch → scan UIN x qty
        console.log(`\n[PACK] Scanning ${skus.length} SKU row(s)`);
        for (let i = 0; i < skus.length; i++) {
            const { uin, qty } = skus[i];
            await this.checkRowCheckbox(i);
            await this.selectBatchForRow(i);
            await this.scanUINMultipleTimes(uin, qty, i);
        }
        console.log('  [OK] All SKU rows scanned');
    }
}


// --- Master Pack Create Page ------------------------------------------------
class MasterPackCreatePage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;
        // Sidebar link — has href="/order/master-packaging", stable anchor
        const nav = page.locator('.ps-sidebar-container');
        this.menuLink = nav.locator('a[href="/order/master-packaging"]');

        // Add New button — aria-label is stable, avoids bg-pink-500 Tailwind class
        this.addNewBtn = page.getByRole('button', { name: 'Add New' });
    }

    async navigate() {
        console.log('\n[NAV] Navigating to Master Pack Create');
        // Direct goto is more reliable than clicking the sidebar link:
        // - Leaf item is inside Outbound submenu which may have collapsed
        // - Clicking a collapsed submenu item lands on wrong element
        // PATHS.MASTER_PACK = BASE_URL + '/order/master-packaging' (add to testConfig.js)
        await this.page.goto(PATHS.MASTER_PACK);
        await this.page.waitForURL('**/order/master-packaging**', { timeout: TIMEOUT.NAVIGATION });
        await waitForPageStable(this.page);
        console.log('  [OK] Master Pack Create page loaded');
    }

    async clickAddNew() {
        console.log('\n[ACTION] Clicking Add New');
        await this.addNewBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.addNewBtn.click();
        console.log('  [OK] Add New clicked');
        await waitForTableLoad(this.page);
    }

    async searchAndSelectPackagingRow(packagingCode, doCode) {
        console.log(`\n[MASTER PACK] Selecting packaging row: ${packagingCode} (DO: ${doCode})`);
        // Wait for the selection panel table to load after clickAddNew()
        await waitForTableLoad(this.page);

        // Search by DO code using the confirmed input[name="doCode"] on the selection panel
        // This input is on the SELECTION PANEL table (opened by clickAddNew), not the form
        // If not found, proceed without filtering — panel may show recent rows only
        const doSearchInput = this.page.locator('input[name="doCode"]');
        const hasDoSearch = await doSearchInput.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false);
        if (hasDoSearch && doCode) {
            await doSearchInput.fill(doCode);
            await doSearchInput.press('Enter');
            await waitForTableLoad(this.page);
            console.log(`  -> Filtered by DO code: ${doCode}`);
        }

        // Match row by packagingCode cell
        const row = this.page
            .locator('tbody tr')
            .filter({ has: this.page.locator(`td:text-is("${packagingCode}")`) })
            .first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
        const checkbox = row.locator('[data-pc-section="checkbox"]');
        await checkbox.click();
        console.log(`  [OK] Row selected: ${packagingCode}`);
    }

    async addMasterPackMaterial(materialQty = 1) {
        console.log('\n[MASTER PACK] Adding packing material');
        // Confirmed from HTML: placeholder id ends in "-placeholder" with text "Packing Material"
        // aria-describedby links each react-select input to its own placeholder element
        // This is robust regardless of how many other dropdowns exist on the page
        const placeholderEl = this.page.locator('[id^="react-select"][id$="-placeholder"]')
            .filter({ hasText: /^Packing Material$/ });
        await placeholderEl.waitFor({ state: 'attached', timeout: TIMEOUT.MEDIUM });
        const placeholderId = await placeholderEl.getAttribute('id');
        console.log(`  [DEBUG] Packing Material placeholder id: ${placeholderId}`);

        const materialInput = this.page.locator(`input[aria-describedby="${placeholderId}"]`);
        await materialInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await materialInput.click();

        const firstOption = this.page.locator('[class*="-option"]').first();
        await firstOption.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const optionText = await firstOption.textContent();
        await firstOption.click();
        console.log(`  -> Material selected: ${optionText?.trim()}`);

        // Confirmed from HTML: name="orderMasterPackagingMaterials[0].quantity"
        const qtyInput = this.page.locator('input[name*="orderMasterPackagingMaterials"][name*="quantity"]');
        await qtyInput.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
        await qtyInput.fill(String(materialQty));
        console.log(`  -> Quantity set to: ${materialQty}`);
    }

    async fillMasterPackDetails(code) {
        console.log(`\n[MASTER PACK] Filling master pack details with code: ${code}`);
        // Confirmed from HTML:
        // name="orderMasterPackagingCode" placeholder="Master code"
        // name="name" placeholder="Package name"
        const masterPackCodeInput = this.page.locator('input[name="orderMasterPackagingCode"]');
        const packageNameInput = this.page.locator('input[name="name"]');

        await masterPackCodeInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await masterPackCodeInput.fill(code);
        console.log(`  -> Master Package Code: ${code}`);

        await packageNameInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await packageNameInput.fill(code);
        console.log(`  -> Package Name: ${code}`);
    }

    async submitMasterPack() {
        console.log('\n[MASTER PACK] Submitting');
        // Confirmed from HTML: <button type="button">Submit</button>
        // No aria-label — use text match. bg-pink-500 is Tailwind styling, avoid as selector.
        // Filter to last Submit button — form submit is typically the last one in DOM
        const submitBtn = this.page.getByRole('button', { name: /^Submit$/ }).last();
        await submitBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await submitBtn.click();
        await waitForToast(this.page, 'success');
        console.log('  [OK] Master pack created successfully');
    }
}


// --- Master Pack Transfer Page ---------------------------------------------
class MasterPackTransferPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;

        // Add New: confirmed from HTML — aria-label="Add New"
        this.addNewBtn = page.getByRole('button', { name: 'Add New' });

        // Transfer code input: confirmed from HTML — name="masterPackageTransferRequestCode"
        this.transferCodeInput = page.locator('input[name="masterPackageTransferRequestCode"]');

        // Warehouse dropdowns: nth(0) = source Warehouse, nth(1) = Destination Warehouse
        // Consistent with rest of codebase — avoids aria-describedby ID fragility
        this.warehouseInput = page.locator('[id^="react-select"][id$="-input"]').nth(0);
        this.destinationInput = page.locator('[id^="react-select"][id$="-input"]').nth(1);
    }

    async navigate() {
        console.log('\n[NAV] Navigating to Master Pack Transfer');
        await this.page.goto(PATHS.MASTER_PACK_TRANSFER);
        await this.page.waitForURL('**/order/master-package-transfer**', { timeout: TIMEOUT.NAVIGATION });
        await waitForPageStable(this.page);
        console.log('  [OK] Master Pack Transfer page loaded');
    }

    async clickAddNew() {
        console.log('\n[ACTION] Clicking Add New');
        await this.addNewBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.addNewBtn.click();
        await waitForPageStable(this.page);
        console.log('  [OK] Add New clicked');
    }

    async fillTransferCode(code) {
        console.log(`\n[TRANSFER] Filling transfer code: ${code}`);
        await this.transferCodeInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.transferCodeInput.fill(code);
        console.log(`  -> Transfer code: ${code}`);
    }

    async selectWarehouse(searchText) {
        console.log(`\n[TRANSFER] Selecting warehouse: ${searchText}`);
        // Confirmed: aria-describedby="react-select-2-placeholder" — source warehouse
        await this.warehouseInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.warehouseInput.click();
        await this.warehouseInput.fill(searchText);
        const option = this.page.locator('[class*="-option"]').filter({ hasText: searchText }).first();
        await option.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await option.click();
        console.log(`  -> Warehouse selected: ${searchText}`);
    }

    async selectDestinationWarehouse(searchText) {
        console.log(`\n[TRANSFER] Selecting destination warehouse: ${searchText}`);
        // Confirmed: aria-describedby="react-select-3-placeholder" — destination warehouse
        await this.destinationInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.destinationInput.click();
        await this.destinationInput.fill(searchText);
        const option = this.page.locator('[class*="-option"]').filter({ hasText: searchText }).first();
        await option.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await option.click();
        console.log(`  -> Destination selected: ${searchText}`);
    }

    async selectMasterPackRow(masterPackCode) {
        console.log(`\n[TRANSFER] Selecting master pack row: ${masterPackCode}`);
        // Confirmed from HTML: checkbox name="masterPackageTransferRequestDetail.N.isSelected"
        // label text contains the master pack code — filter by label text
        const row = this.page
            .locator('tbody tr')
            .filter({ hasText: masterPackCode })
            .first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        const checkbox = row.locator('.p-checkbox-box');
        await checkbox.click();
        console.log(`  [OK] Master pack row selected: ${masterPackCode}`);
    }

    async submitTransfer(masterPackCode) {
        console.log('\n[TRANSFER] Submitting transfer');
        const submitBtn = this.page.getByRole('button', { name: /^Submit$/ }).last();
        await submitBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await submitBtn.click();
        await waitForToast(this.page, 'success');
        console.log('  [OK] Transfer submitted successfully');
    }

    async assertTransferRecordExists(transferCode) {
        // After submit, page navigates to Transfer List — confirmed from screenshot
        // List shows Package Transfer Code column — assert by transferCode not masterPackCode
        console.log(`\n[ASSERT] Verifying transfer record: ${transferCode}`);
        await expect(
            this.page.locator('tbody tr').filter({ hasText: transferCode }).first()
        ).toBeVisible({ timeout: TIMEOUT.LONG });
        console.log(`  [OK] Transfer record confirmed in table: ${transferCode}`);
    }
}

// --- Product Without Stock / Assign Supplier Page ---------------------------
class ProductWithoutStockPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;

        const nav = page.locator('.ps-sidebar-container');
        this.commercialMenu = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.COMMERCIAL}$`) });
        this.productSubmenu = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.PRODUCT}$`) });
        this.productsLink = nav.locator('a').filter({ hasText: new RegExp(`^${MENU.PRODUCTS}$`) });

        this.tabNav = page.locator('ul.p-tabmenu-nav');
        this.withoutStockTab = this.tabNav.locator('a').filter({ hasText: /^Without Stock$/ });

        this.searchBtn = page.getByRole('button', { name: /^Search$/i });
        this.selectAllCheckbox = page.locator('thead [data-pc-section="headercheckbox"], thead .p-checkbox-box').first();

        // Confirmed: button[type="submit"] disabled until Brand+Supplier both selected & rows checked
        this.assignSupplierBtn = page.locator('button[type="submit"]').filter({ hasText: /^Assign Supplier$/ });
    }

    // --- Navigation ---------------------------------------------------------

    async navigateToProductList() {
        console.log('\n[NAV] Navigating to Commercial > Product > Products');

        await this.commercialMenu.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
        await this.commercialMenu.click();
        console.log('  -> Commercial menu clicked');

        await expect(this.productSubmenu).toBeVisible({ timeout: TIMEOUT.MEDIUM });
        await this.productSubmenu.click();
        console.log('  -> Product submenu clicked');

        await expect(this.productsLink).toBeVisible({ timeout: TIMEOUT.MEDIUM });
        await this.productsLink.click();
        console.log('  -> Products link clicked');

        await this.page.waitForURL('**/product/list**', { timeout: TIMEOUT.NAVIGATION });
        await waitForPageStable(this.page);
        await waitForTableLoad(this.page);
        console.log('  [OK] Product list page loaded');
    }

    // --- Tabs -----------------------------------------------------------------

    async switchToWithoutStockTab() {
        console.log('\n[TAB] Switching to Without Stock tab');
        // Clicking the tab is unreliable post-reload: PrimeReact's p-highlight can
        // already be set from before the reload while the underlying fetch/filter
        // state defaults to With Stock — clicking an "already active" tab is then
        // a no-op that changes nothing. Force the actual URL instead of trusting
        // any UI signal derived from a click.
        const currentUrl = new URL(this.page.url());
        currentUrl.searchParams.set('statusId', '0');
        await this.page.goto(currentUrl.toString());
        await waitForPageStable(this.page); // full reload — let hydration finish before touching the form
        await waitForTableLoad(this.page);
        console.log('  [OK] Without Stock tab active');
    }

    // --- Search & Filters ----------------------------------------------------

    async clickSearch() {
        console.log('\n[ACTION] Clicking Search to filter table');
        await this.searchBtn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.searchBtn.click();
        await waitForPageStable(this.page);
        await waitForTableLoad(this.page);
        console.log('  [OK] Table filtered');
    }

    async searchBySku(sku) {
        console.log(`\n[SEARCH] Searching by SKU: ${sku}`);
        const skuInput = this.page.locator('input[placeholder="Product sku"], input[name="sku"]').first();
        await skuInput.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await skuInput.clear();
        await skuInput.fill(sku);
        await skuInput.press('Tab');
        await this.clickSearch();
    }

    // --- Checkbox selection ---------------------------------------------------

    async selectAllRows() {
        console.log('\n[CHECKBOX] Selecting all rows');
        await this.selectAllCheckbox.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await this.selectAllCheckbox.click();
        console.log('  [OK] All rows selected');
    }

    async selectRowBySku(sku) {
        console.log(`\n[CHECKBOX] Selecting row for SKU: ${sku}`);
        const row = this.page.locator('tbody tr').filter({ hasText: sku }).first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
        const checkbox = row.locator('[data-pc-section="checkbox"], .p-checkbox-box, [role="checkbox"]').first();
        await checkbox.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await checkbox.click();
        console.log(`  [OK] Row selected for SKU: ${sku}`);
    }

    // --- Brand / Supplier selection ------------------------------------------

    /**
     * Select a react-select option by its placeholder label text.
     * Same aria-describedby pattern as MasterPackCreatePage.addMasterPackMaterial —
     * required because the placeholder here is a <div>, not label/p/span, so
     * the seller-side selectDropdown() helper does not match it.
     * @param {string} placeholderText
     * @param {string} value
     */
    async _selectReactSelectByPlaceholder(placeholderText, value) {
        const placeholderEl = this.page
            .locator('[id^="react-select"][id$="-placeholder"]')
            .filter({ hasText: new RegExp(`^${placeholderText}$`) });
        await placeholderEl.waitFor({ state: 'attached', timeout: TIMEOUT.MEDIUM });
        const placeholderId = await placeholderEl.getAttribute('id');

        const input = this.page.locator(`input[aria-describedby="${placeholderId}"]`);
        await input.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await input.click();
        await input.fill(value);

        // Wait for at least one option to appear
        await this.page.locator('[class*="-option"]').first().waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

        // 1. Try exact match first
        const exactOption = this.page
            .locator('[class*="-option"]')
            .filter({
                hasText: new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'i')
            });

        const exactCount = await exactOption.count();

        let selectedText = '';

        if (exactCount === 1) {
            selectedText = (await exactOption.first().textContent())?.trim() ?? value;
            await exactOption.first().click();
        } else if (exactCount > 1) {
            throw new Error(
                `Multiple exact matches for "${value}" under ${placeholderText}.`
            );
        } else {
            // 2. No exact match, so try substring match
            const substringOption = this.page
                .locator('[class*="-option"]')
                .filter({
                    hasText: new RegExp(
                        value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'),
                        'i'
                    )
                });

            const matchCount = await substringOption.count();

            if (matchCount === 0) {
                throw new Error(
                    `No option found for "${value}" under ${placeholderText}.`
                );
            }

            if (matchCount > 1) {
                throw new Error(
                    `Ambiguous match for "${value}" under ${placeholderText}: ${matchCount} options matched. Use a more specific value.`
                );
            }

            selectedText = (await substringOption.first().textContent())?.trim() ?? value;
            await substringOption.first().click();
        }

        console.log(`  -> Selected "${selectedText}" for ${placeholderText}`);

        // Confirm the selected value is reflected in the control's single-value display —
        // same verification pattern seller-side selectBrand() already uses.
        const singleValue = this.page.locator('.css-1dimb5e-singleValue, [class*="-singleValue"]').filter({ hasText: new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') });
        await singleValue.waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
    }

    async selectBrand(brand) {
        console.log(`\n[FILTER] Selecting brand: ${brand}`);
        await this._selectReactSelectByPlaceholder('Brand', brand);
        await this.clickSearch();
    }

    async selectSupplier(supplier) {
        console.log(`\n[FILTER] Selecting supplier: ${supplier}`);
        await this._selectReactSelectByPlaceholder('Supplier', supplier);
    }

    // --- Assign ---------------------------------------------------------------

    async clickAssignSupplier() {
        console.log('\n[ACTION] Clicking Assign Supplier');
        // Button starts disabled — wait for it to become enabled once both
        // Brand and Supplier are selected, and row(s) are checked.
        await expect(this.assignSupplierBtn).toBeEnabled({ timeout: TIMEOUT.MEDIUM });
        await this.assignSupplierBtn.click();
        console.log('  -> Assign Supplier clicked');

        await waitForToast(this.page, 'success');
        await waitForPageStable(this.page);
        console.log('  [OK] Supplier assigned successfully');
    }

    // --- Verification ---------------------------------------------------------

    /**
     * After assigning, re-search by SKU and confirm the Suppliers column
     * reflects the assignment. Suppliers is the last column in the table
     * (confirmed from live DOM: unassigned rows show "n/a - n/a").
     * @param {string} sku
     * @param {string} supplierCode - e.g. 'S10110'
     */
    async verifySupplierAssigned(sku, supplierCode) {
        console.log(`\n[VERIFY] Confirming supplier assignment for SKU: ${sku}`);
        await this.switchToWithoutStockTab();
        // switchToWithoutStockTab() is now a hard reload — it wipes the SKU field.
        // Don't assume any prior filter state survived; refill it explicitly.
        await this.searchBySku(sku);

        const row = this.page.locator('tbody tr').filter({ hasText: sku }).first();
        await row.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });

        const suppliersCell = row.locator('td').last();
        const cellText = (await suppliersCell.textContent())?.trim() ?? '';
        console.log(`  [INFO] Suppliers cell for ${sku}: "${cellText}"`);

        if (cellText.includes('n/a') || !cellText.includes(supplierCode)) {
            throw new Error(
                `Supplier assignment not reflected for SKU ${sku}. Expected cell to contain "${supplierCode}", got: "${cellText}"`
            );
        }
        console.log(`  [OK] Supplier assignment confirmed for SKU ${sku}: "${cellText}"`);
    }
}

module.exports = {
    LoginPage,
    OutboundApprovalPage,
    PackingScanPage,
    MasterPackCreatePage,
    MasterPackTransferPage,
    ProductWithoutStockPage
};