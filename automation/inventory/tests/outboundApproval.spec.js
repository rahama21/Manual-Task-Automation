// @ts-check
const { test } = require('@playwright/test');
const { CREDENTIALS, OTP } = require('../../../config/testConfig');
const { generateMasterPackCode } = require('../../../utils/dataGenerator');
const {
    LoginPage,
    OutboundApprovalPage,
    PackingScanPage,
    MasterPackCreatePage,
    MasterPackTransferPage
} = require('../pages/inventoryWorkflow.pages');

// ─── Test Data ───────────────────────────────────────────────────────────────
const ORDER_NUMBER          = '26081199959554';
const MATERIAL_QTY          = 1;
const WAREHOUSE             = 'Tejgaon Warehouse';
const DESTINATION_WAREHOUSE = 'Tejgaon Sort Center';

// Update SKUS per order — 1 entry for single SKU, multiple for multi-SKU orders
const SKUS = [
    
    { uin: 'CU-1723155-2854348', qty: 2 },
     // { uin: 'CU-1723146-2854329', qty: 2 },
     
    ];

test.describe('Outbound Order Approval', () => {

    test.beforeEach(async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login(CREDENTIALS.username, CREDENTIALS.password);
        await loginPage.enterOtp(OTP);
        await loginPage.waitForDashboard();
    });

    test('approve outbound order, scan UINs, add package, create master pack, transfer', async ({ page, context }) => {
        const outboundPage = new OutboundApprovalPage(page);

        // Step 1: Navigate to Outbound Order Approval
        await outboundPage.navigateToOutboundApproval();

        // Step 2: Pending tab → approve if not yet approved
        await outboundPage.switchToPendingTab();
        await outboundPage.searchOrder(ORDER_NUMBER);
        const isInPending = await outboundPage.isOrderInCurrentTab(ORDER_NUMBER);

        if (isInPending) {
            console.log('[INFO] Order found in Pending — approving');
            await outboundPage.selectOrderCheckbox(ORDER_NUMBER);
            await outboundPage.clickBulkApprove();
        } else {
            console.log('[INFO] Order already approved — skipping approval');
        }

        // Step 3: Approved tab → get DO code → open packing page
        await outboundPage.switchToApprovedTab();
        // Poll until order appears in Approved tab — backend may lag after bulk approve
        await outboundPage.waitForOrderInApprovedTab(ORDER_NUMBER);
        const doCode = await outboundPage.getDOCode(ORDER_NUMBER);
        console.log(`[INFO] DO code: ${doCode}`);

        const [newPage] = await Promise.all([
            context.waitForEvent('page'),
            outboundPage.clickDOLink(ORDER_NUMBER)
        ]);

        // Step 4: Packing page — batch, scan, add package
        const packPage = new PackingScanPage(newPage);
        await packPage.waitForPage();
        await packPage.scanAllSKUs(SKUS);
        await packPage.addPackageWithMaterial(MATERIAL_QTY);

        const packagingCode = await packPage.getPackagingCode();
        console.log(`[INFO] Packaging code: ${packagingCode}`);

        // Step 5: Master Pack Create
        const masterPackPage = new MasterPackCreatePage(newPage);
        await masterPackPage.navigate();
        await masterPackPage.clickAddNew();

        const masterPackCode = generateMasterPackCode();
        await masterPackPage.searchAndSelectPackagingRow(packagingCode, doCode);
        await masterPackPage.fillMasterPackDetails(masterPackCode);
        await masterPackPage.addMasterPackMaterial(MATERIAL_QTY);
        await masterPackPage.submitMasterPack();

        // Step 6: Master Pack Transfer
        const transferPage = new MasterPackTransferPage(newPage);
        await transferPage.navigate();
        await transferPage.clickAddNew();

        const transferCode = `MPT-${generateMasterPackCode()}`;
        await transferPage.fillTransferCode(transferCode);
        await transferPage.selectWarehouse(WAREHOUSE);
        await transferPage.selectDestinationWarehouse(DESTINATION_WAREHOUSE);
        await transferPage.selectMasterPackRow(masterPackCode);
        await transferPage.submitTransfer();
        await transferPage.assertTransferRecordExists(transferCode);
    });

});