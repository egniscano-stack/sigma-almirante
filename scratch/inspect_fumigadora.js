import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const DESKTOP_DIR = '/Users/egniscanorodrigues/Desktop/municipio de almirante';
const file = 'fumigadora.xlsx';

const filePath = path.join(DESKTOP_DIR, file);
if (!fs.existsSync(filePath)) {
    console.log(`\n--- ${file} (NOT FOUND) ---`);
    process.exit(1);
}
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log(`\n--- ${file} ---`);
console.log(`Total rows: ${rows.length}`);

// Print first 10 rows to see where the data starts and what column it's in
rows.slice(0, 15).forEach((r, i) => console.log(`Row ${i}:`, r));
