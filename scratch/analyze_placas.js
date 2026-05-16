
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/CONTROL DE PLACAS  SHANTAL.xlsx';

function analyze() {
  console.log('--- Analizando Excel de Placas ---');
  if (!fs.existsSync(filePath)) {
    console.error('Archivo no encontrado:', filePath);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\nHoja: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Print first 10 rows to see headers and data
    rows.slice(0, 10).forEach((row, i) => {
      console.log(`Row ${i}:`, JSON.stringify(row));
    });
  });
}

analyze();
