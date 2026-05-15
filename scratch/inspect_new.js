
import XLSX from 'xlsx';
import path from 'path';

const files = [
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/bares.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/basura2026.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/buhoneria.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/farmacia.xlsx'
];

function inspectNew() {
  for (const filePath of files) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      console.log(`\nStructure of ${path.basename(filePath)} (first 3 rows):`);
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
    } catch (err) {
      console.error(`Error reading ${path.basename(filePath)}:`, err.message);
    }
  }
}

inspectNew();
