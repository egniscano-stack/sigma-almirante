
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/CONTROL DE PLACAS  SHANTAL.xlsx';

function analyze() {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (rows.length < 10) return;

    console.log(`\nSheet: ${sheetName}`);
    const row5 = rows[5] || [];
    console.log("Headers (Row 5):", JSON.stringify(row5));
  });
}

analyze();
