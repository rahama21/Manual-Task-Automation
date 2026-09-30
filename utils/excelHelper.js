// @ts-check
const XLSX = require('xlsx');

/**
 * Reads an exported product-cost Excel file, fills the Cost(*) column
 * for every data row with a random price, and overwrites the file in place.
 * Column is located by header text, not position — resilient to column
 * reordering in future exports.
 * @param {string} filePath
 * @param {{ min?: number, max?: number }} [range]
 * @returns {number[]} the cost values written, one per row, for later assertion
 */
function fillCostColumn(filePath, range = {}) {
    const min = range.min ?? 50;
    const max = range.max ?? 500;

    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Products'; // confirmed sheet tab name from your screenshot
    const sheet = workbook.Sheets[sheetName];

    const headerRow = XLSX.utils.decode_range(sheet['!ref']).s.r; // row 0
    let costColIndex = -1;
    let col = 0;
    while (true) {
        const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c: col });
        const cell = sheet[cellAddr];
        if (!cell) break;
        if (String(cell.v).trim() === 'Cost(*)') {
            costColIndex = col;
            break;
        }
        col++;
    }
    if (costColIndex === -1) {
        throw new Error(`Could not find "Cost(*)" column header in ${filePath}`);
    }

    const range2 = XLSX.utils.decode_range(sheet['!ref']);
    const writtenValues = [];
    for (let row = headerRow + 1; row <= range2.e.r; row++) {
        const nameCellAddr = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (!sheet[nameCellAddr]) continue; // skip blank trailing rows

        const cost = Math.floor(Math.random() * (max - min + 1)) + min;
        const costCellAddr = XLSX.utils.encode_cell({ r: row, c: costColIndex });
        sheet[costCellAddr] = { t: 'n', v: cost };
        writtenValues.push(cost);
    }

    XLSX.writeFile(workbook, filePath);
    console.log(`  [OK] Filled Cost(*) column for ${writtenValues.length} row(s): ${writtenValues.join(', ')}`);
    return writtenValues;
}

function readCostColumn(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Products';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
        throw new Error(`Sheet "${sheetName}" not found or empty in ${filePath}`);
    }
    const range = XLSX.utils.decode_range(sheet['!ref']);

    let skuColIndex = -1;
    let costColIndex = -1;
    for (let col = range.s.c; col <= range.e.c; col++) {
        const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
        if (!header) continue;
        const text = String(header.v).trim();
        if (text === 'ShopSKU') skuColIndex = col;
        if (text === 'Cost(*)') costColIndex = col;
    }
    if (skuColIndex === -1 || costColIndex === -1) {
        throw new Error(`Could not locate ShopSKU/Cost(*) columns in ${filePath}`);
    }

    const result = {};
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const skuCell = sheet[XLSX.utils.encode_cell({ r: row, c: skuColIndex })];
        if (!skuCell || skuCell.v === undefined || skuCell.v === null || String(skuCell.v).trim() === '') continue;
        const costCell = sheet[XLSX.utils.encode_cell({ r: row, c: costColIndex })];
        result[String(skuCell.v).trim()] = costCell && costCell.v !== undefined && costCell.v !== null && costCell.v !== '' ? Number(costCell.v) : null;
    }
    return result;
}

module.exports = { fillCostColumn, readCostColumn };
