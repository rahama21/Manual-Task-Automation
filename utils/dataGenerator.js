// @ts-check

/**
 * Data Generator — creates unique, timestamped values for test data.
 * All generated values include timestamps to avoid collisions across runs.
 */

/**
 * Generate a compact timestamp string (e.g., "20260305130930123").
 * @returns {string}
 */
function generateTimestamp() {
    return new Date().toISOString().replace(/[-:.TZ]/g, '');
}

/**
 * Generate a unique Master Pack code.
 * Format: MP-<timestamp>
 * @returns {string}
 */
function generateMasterPackCode() {
    return `MP-${generateTimestamp()}`;
}

/**
 * Generate a unique package name.
 * Format: PKG-<timestamp>
 * @returns {string}
 */
function generatePackageName() {
    return `PKG-${generateTimestamp()}`;
}

/**
 * Generate a unique UIN (Unique Identification Number).
 * Format: UIN-<timestamp>-<random4digits>
 * @returns {string}
 */
function generateUIN() {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `UIN-${generateTimestamp()}-${random}`;
}

/**
 * Generate multiple unique UINs.
 * @param {number} count — number of UINs to generate
 * @returns {string[]}
 */
function generateMultipleUINs(count) {
    const uins = [];
    for (let i = 0; i < count; i++) {
        uins.push(generateUIN());
    }
    return uins;
}

/**
 * Generate a set of test data for the full outbound workflow.
 * @returns {{ masterPackCode: string, packageName: string, uins: string[] }}
 */
function generateOutboundTestData() {
    return {
        masterPackCode: generateMasterPackCode(),
        packageName: generatePackageName(),
        uins: generateMultipleUINs(5),
    };
}

module.exports = {
    generateTimestamp,
    generateMasterPackCode,
    generatePackageName,
    generateUIN,
    generateMultipleUINs,
    generateOutboundTestData,
};
