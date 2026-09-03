// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { LoginPage } = require('../pages/sellerLogin.page');
const { ProductPage } = require('../pages/product.page');
const { CREDENTIALS } = require('../../../config/testConfig');

function createProduct() {
    const uniqueSuffix = new Date().toISOString().replace(/[-:.TZ]/g, '');

    return {
        name: `Test Product ${uniqueSuffix}`,
        imagePath: path.resolve(__dirname, '../../../assets/image.jpg'),
        categoryPath: [
            "Home Appliances",
            "Cooling  Heating",
            "Fan",
            "Mini Fans"
        ],
        brand: 'Apple',
        unit: 'pcs',
        colors: ['Black', '#03 COOL PEACH'],
        price: '100',
        weight: '1',
        length: '1',
        width: '1',
        height: '1',
    };
}

const PRODUCT = createProduct();

// --- Test -------------------------------------------------------------------

test.describe('CartUp Seller Portal: Add Product', () => {

    test('Complete Add Product Flow', async ({ page, context }) => {
        test.setTimeout(180000);

        const loginPage = new LoginPage(page);
        const productPage = new ProductPage(page, context);

        // STEP 1: LOGIN
        await test.step('Login to Seller Portal', async () => {
            await loginPage.goto();
            await loginPage.login(CREDENTIALS.username, CREDENTIALS.password);
            await loginPage.waitForDashboard();
        });

        // STEP 2: NAVIGATE TO ADD PRODUCT
        await test.step('Navigate to Add Product page', async () => {
            await productPage.navigateToAddProduct();
        });

        // Guard: ensure we are on the Add Product page
        productPage.assertOnAddProductPage();

        // STEP 3: FILL PRODUCT FORM
        await test.step('Fill Product Form', async () => {
            await productPage.uploadImage(PRODUCT.imagePath);
            await productPage.fillProductName(PRODUCT.name);
            await productPage.selectCategory(PRODUCT.categoryPath);
            await productPage.selectBrand(PRODUCT.brand);
            await productPage.selectUnit(PRODUCT.unit);
            await productPage.addVariants(PRODUCT.colors, PRODUCT.imagePath, PRODUCT.brand, PRODUCT.unit);
            await productPage.fillPrice(PRODUCT.price);
            await productPage.fillPackageDetails({
                weight: PRODUCT.weight,
                length: PRODUCT.length,
                width: PRODUCT.width,
                height: PRODUCT.height,
            });
        });

        // STEP 4: SUBMIT
        await test.step('Submit Product', async () => {
            const [createResponse] = await Promise.all([
                productPage.getActivePage().waitForResponse(resp => resp.url().includes('/product/create') && (resp.status() === 200 || resp.status() === 201)),
                productPage.submitProduct(),
            ]);
            const body = await createResponse.json();
            const capturedSkus = body.data.ProductVariants.map(v => v.ShopSKU);
            console.log(`  [CAPTURE] Captured SKUs: ${capturedSkus.join(', ')}`);

            const outPath = path.resolve(__dirname, '../../../captured-sku.json');
            fs.writeFileSync(outPath, JSON.stringify({ skus: capturedSkus, capturedAt: new Date().toISOString() }));
            console.log(`  [OK] Wrote SKU(s) to ${outPath}`);
        });

        // STEP 5: VERIFY
        await test.step('Verify Product Added', async () => {
            await productPage.verifyProductInPending(PRODUCT.name);
        });
    });

    test.afterEach(async ({ context }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const pages = context.pages();
            if (pages.length === 0) {
                console.log('\n[FAIL] Test failed — all pages closed');
                return;
            }
            const activePage = pages[pages.length - 1];
            console.log(`\n[FAIL] Test failed at URL: ${activePage.url()}`);
            await activePage.screenshot({ path: 'failure-screenshot.png', fullPage: true }).catch(() => { });
        }
    });
});
