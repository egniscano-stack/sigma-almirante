
import XLSX from 'xlsx';
const VIGENCIA_FILE = '/Users/egniscanorodrigues/Desktop/municipio de almirante/Vigencia expirada.xlsx';
const workbook = XLSX.readFile(VIGENCIA_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Vigencia Expirada Sample Row:', JSON.stringify(rows[1]));
