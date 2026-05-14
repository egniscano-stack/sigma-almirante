
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/buhoneria.xlsx';

function analyze() {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`Hoja: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('Encabezados:', data[0]);
    console.log('Primeras 3 filas:', data.slice(1, 4));
  });
}

analyze();
