import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/abarroteria.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log(rows.slice(0, 10));
