import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const DESKTOP_DIR = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante';

const FILES_TO_PROCESS = [
  { file: 'almacen.xlsx' },
  { file: 'barberia.xlsx' },
  { file: 'bares.xlsx' },
  { file: 'basura2026.xlsx' },
  { file: 'buhoneria.xlsx' },
];

for (const item of FILES_TO_PROCESS) {
  const filePath = path.join(DESKTOP_DIR, item.file);
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  console.log(`\n--- ${item.file} ---`);
  console.log(`Total rows: ${rows.length}`);
  console.log("Row 2:", rows[2]);
  console.log("Row 3:", rows[3]);
}
