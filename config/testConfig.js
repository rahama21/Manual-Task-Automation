// @ts-check

// -----------------------------------------------------------------------------
// Environment selection
// -----------------------------------------------------------------------------
const SYSTEM = (process.env.TEST_SYSTEM || 'inventory').trim();
// options: "inventory" | "seller"

// -----------------------------------------------------------------------------
// Shared Configuration
// -----------------------------------------------------------------------------
const TIMEOUT = {
    SHORT: 2000,
    MEDIUM: 5000,
    LONG: 10000,
    EXTRA_LONG: 15000,
    NAVIGATION: 30000,
    PROCESS: 60000,
    LOGIN_REDIRECT: 60000,
    POLL_INTERVAL: 300,
    CATEGORY_POLL_MAX: 15000,
    CONTENT_CHANGE_MAX: 10000,
};

const OTP = process.env.OTP;

// -----------------------------------------------------------------------------
// System Configurations
// -----------------------------------------------------------------------------
const SYSTEM_CONFIG = {

    inventory: {
        BASE_URL: 'https://pre-prod-inventory.cartup.com',

        CREDENTIALS: {
            username: process.env.INVENTORY_USERNAME,
            password: process.env.INVENTORY_PASSWORD,
        },

        PATHS: {
            LOGIN: '/auth/login',
            DASHBOARD: '/',
            OUTBOUND_APPROVAL: '/order/delivery/approval',
            DELIVERY_ORDER: '/delivery-order',
            MASTER_PACK: '/order/master-packaging',  // fixed: was '/master-pack'
            MASTER_PACK_TRANSFER: '/order/master-package-transfer',  // confirmed from browser URL
        },

        MENU: {
            OPERATION: 'Operation',
            OUTBOUND: 'Outbound',
            OUTBOUND_APPROVAL: 'Outbound Order Approval',
        },

        SCAN: {
            EXPECTED_QUANTITY: 5,
            MAX_RETRIES: 3,
            RETRY_DELAY_MS: 1000,
        }
    },

    seller: {
        BASE_URL: 'https://pre-prod-partner.cartup.com',

        CREDENTIALS: {
            username: process.env.CARTUP_USERNAME,
            password: process.env.CARTUP_PASSWORD,
        },

        PATHS: {
            LOGIN: '/auth/login',
            DASHBOARD: '/',
        },

        MENU: {},

        SCAN: {}
    }
};

// -----------------------------------------------------------------------------
// Active Configuration
// -----------------------------------------------------------------------------
const config = SYSTEM_CONFIG[SYSTEM];

if (!config) {
    throw new Error(`Invalid TEST_SYSTEM: ${SYSTEM}`);
}

if (!config.CREDENTIALS.username || !config.CREDENTIALS.password || !OTP) {
    throw new Error(
        `Missing credentials or OTP for ${SYSTEM}. Check environment variables.`
    );
}


// Convert relative paths → full URLs
const PATHS = Object.fromEntries(
    Object.entries(config.PATHS).map(([key, value]) => [key, `${config.BASE_URL}${value}`])
);

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------
module.exports = {
    SYSTEM,
    BASE_URL: config.BASE_URL,
    CREDENTIALS: config.CREDENTIALS,
    TIMEOUT,
    OTP,
    PATHS,
    MENU: config.MENU,
    SCAN: config.SCAN,
};