import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const DESKTOP_DIR = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante';

const FILES_TO_PROCESS = [
  'restaurante.xlsx',
  'ropa americana.xlsx',
  'supermercados.xlsx',
  'Taller.xlsx',
  'taxi mar.xlsx',
  'Vigencia expirada.xlsx'
];

for (const file of FILES_TO_PROCESS) {
  const filePath = path.join(DESKTOP_DIR, file);
  if (!fs.existsSync(filePath)) {
      console.log(`\n--- ${file} (NOT FOUND) ---`);
      continue;
  }
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  console.log(`\n--- ${file} ---`);
  console.log(`Total rows: ${rows.length}`);
  
  rows.slice(0, 5).forEach((r, i) => console.log(`Row ${i}:`, r));
}
