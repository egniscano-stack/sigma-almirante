import XLSX from 'xlsx';
import fs from 'fs';

const filePath = "/Users/egniscanorodrigues/Desktop/municipio de almirante/2. EJECUCION DE INGRESO DEL 2026..xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  console.log("Sheet names:", workbook.SheetNames);
  
  const result = {};
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    result[sheetName] = data.slice(0, 100); // Get first 100 rows for analysis
  }
  
  fs.writeFileSync('./scratch/excel_content.json', JSON.stringify(result, null, 2));
  console.log("Successfully wrote first 100 rows of each sheet to ./scratch/excel_content.json");
} catch (error) {
  console.error("Error reading excel:", error);
}
