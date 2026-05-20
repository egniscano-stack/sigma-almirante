import XLSX from 'xlsx';
import fs from 'fs';

const filePath = "/Users/egniscanorodrigues/Desktop/municipio de almirante/2. EJECUCION DE INGRESO DEL 2026..xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  console.log("Parsing all sheets:", workbook.SheetNames);
  
  const result = {};
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const budgetLines = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const codigo = row[0];
      const detalle = row[1];
      
      if (codigo && typeof codigo === 'string' && (codigo.match(/^\d+(\.\d+)+\.?$/))) {
        budgetLines.push({
          codigo: codigo.trim(),
          detalle: detalle ? detalle.trim() : '',
          presupuestoLey: typeof row[2] === 'number' ? row[2] : 0,
          ajustes: typeof row[3] === 'number' ? row[3] : 0,
          presupuestoModificado: typeof row[4] === 'number' ? row[4] : 0,
          saldoALaFecha: typeof row[5] === 'number' ? row[5] : 0,
          ingresosAlMes: typeof row[6] === 'number' ? row[6] : 0,
          ingresosAlTrimestre: typeof row[7] === 'number' ? row[7] : 0,
          ingresosALaFecha: typeof row[8] === 'number' ? row[8] : 0,
          saldo: typeof row[9] === 'number' ? row[9] : 0
        });
      }
    }
    
    result[sheetName] = budgetLines;
    console.log(`Parsed ${budgetLines.length} rows for sheet ${sheetName}`);
  }
  
  fs.writeFileSync('./data/budget_execution_all_months.json', JSON.stringify(result, null, 2));
  console.log("Successfully wrote all sheets to ./data/budget_execution_all_months.json");
  
} catch (error) {
  console.error("Error reading or parsing excel:", error);
}
