// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { LoginPage, ProductWithoutStockPage } = require('../pages/inventoryWorkflow.pages');
const { CREDENTIALS, OTP } = require('../../../config/testConfig');
const { fillCostColumn } = require('../../../utils/excelHelper');

test.describe('CartUp Inventory Portal: Assign Supplier', () => {

    test('Assign supplier to Apple products without stock', async ({ page }) => {
        test.setTimeout(120000);

        const skuFilePath = path.resolve(__dirname, '../../../captured-sku.json');
        if (!fs.existsSync(skuFilePath)) {
            throw new Error(`No captured SKU file found at ${skuFilePath}. Run addProduct.spec.js first.`);
        }
        const { skus: TARGET_SKUS } = JSON.parse(fs.readFileSync(skuFilePath, 'utf-8'));
        if (!TARGET_SKUS || TARGET_SKUS.length === 0) {
            throw new Error('captured-sku.json has no SKUs.');
        }
        console.log(`  [INFO] Using captured SKUs: ${TARGET_SKUS.join(', ')}`);

        const loginPage = new LoginPage(page);
        const productListPage = new ProductWithoutStockPage(page);

        await test.step('Login to Inventory Portal', async () => {
            await loginPage.goto();
            await loginPage.login(CREDENTIALS.username, CREDENTIALS.password);
            await loginPage.enterOtp(OTP);
            await loginPage.waitForDashboard();
        });

        await test.step('Navigate to Products list', async () => {
            await productListPage.navigateToProductList();
        });

        for (const sku of TARGET_SKUS) {
            await test.step(`Assign supplier for SKU ${sku}`, async () => {
                await productListPage.switchToWithoutStockTab();
                await productListPage.selectBrand('Apple');
                await productListPage.searchBySku(sku);
                await productListPage.selectSupplier('tel');
                await productListPage.selectRowBySku(sku);
                await productListPage.clickAssignSupplier();
                await productListPage.verifySupplierAssigned(sku, 'S10110');
            });

            await test.step(`Export, fill cost, import for SKU ${sku}`, async () => {
                await productListPage.selectRowBySku(sku);
                const filePath = await productListPage.exportSelected();
                fillCostColumn(filePath);
                await productListPage.importCostFile(filePath);
            });
        }
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            console.log(`\n[FAIL] Test failed at URL: ${page.url()}`);
            await page.screenshot({ path: 'failure-assign-supplier.png', fullPage: true }).catch(() => { });
        }
    });
});
