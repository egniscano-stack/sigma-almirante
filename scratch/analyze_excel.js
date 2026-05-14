
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/AÑO 2026 TESORERIA.xlsx';

function analyze() {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);

    console.log('--- Análisis de Excel ---');
    console.log(`Hojas encontradas: ${workbook.SheetNames.join(', ')}`);

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      console.log(`\nHoja: ${sheetName}`);
      console.log(`Total filas: ${data.length}`);
      
      if (data.length > 0) {
        console.log('Encabezados detectados:', data[0]);
        console.log('Primeras 3 filas de datos:');
        console.log(data.slice(1, 4));
      }
    });
  } catch (err) {
    console.error('Error al leer el archivo:', err.message);
  }
}

analyze();
