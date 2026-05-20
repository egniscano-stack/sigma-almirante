import XLSX from 'xlsx';
import fs from 'fs';

const filePath = "/Users/egniscanorodrigues/Desktop/municipio de almirante/2. EJECUCION DE INGRESO DEL 2026..xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  console.log("Sheet names in workbook:", workbook.SheetNames);
  
  // Let's use the first sheet (e.g. ENERO 2026) to define the base budget structure
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const budgetLines = [];
  
  // Rows start after the header (which is around index 4 or 5)
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const codigo = row[0];
    const detalle = row[1];
    
    // Check if the first cell matches a budget code format (like 1.1.2.5. or 1.1.2.5.01)
    if (codigo && typeof codigo === 'string' && (codigo.match(/^\d+(\.\d+)+\.?$/))) {
      budgetLines.push({
        index: i,
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
  
  fs.writeFileSync('./scratch/parsed_budget_lines.json', JSON.stringify(budgetLines, null, 2));
  console.log(`Successfully parsed ${budgetLines.length} budget lines and saved to ./scratch/parsed_budget_lines.json`);
  
} catch (error) {
  console.error("Error reading or parsing excel:", error);
}
