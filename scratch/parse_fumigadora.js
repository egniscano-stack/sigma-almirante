import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = '/Users/egniscanorodrigues/Desktop/municipio de almirante/fumigadora.xlsx';

if (!fs.existsSync(filePath)) {
  console.error('Archivo no encontrado:', filePath);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

const taxpayers = [];
let currentTaxpayer = null;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row) continue;

  const col0 = row[0] ? String(row[0]).trim() : null;
  const col1 = row[1] ? String(row[1]).trim() : null;
  const col2 = row[2] ? String(row[2]).trim() : null;

  if (col1 === '11.25.65') {
    // Main activity row
    currentTaxpayer = {
      name: col0,
      address: col2 || 'ALMIRANTE',
      codes: ['11.25.65']
    };
    taxpayers.push(currentTaxpayer);
  } else if (col1 === '11.25.30') {
    // Secondary row (signage)
    if (currentTaxpayer) {
      if (col0 && col0 !== 'CONTRIBUYENTE' && col0 !== 'NOMBRE') {
        // If there's a name part here, append it
        currentTaxpayer.name = `${currentTaxpayer.name} ${col0}`.trim();
      }
      currentTaxpayer.codes.push('11.25.30');
    }
  }
}

console.log('--- Contribuyentes parsed de fumigadora.xlsx ---');
taxpayers.forEach((t, idx) => {
  console.log(`Taxpayer ${idx + 1}:`);
  console.log(`  Name: "${t.name}"`);
  console.log(`  Address: "${t.address}"`);
  console.log(`  Codes: ${JSON.stringify(t.codes)}`);
});
