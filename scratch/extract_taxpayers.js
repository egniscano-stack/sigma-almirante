
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/AÑO 2026 TESORERIA.xlsx';

function process() {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  const allTaxpayers = [];
  const seenCodes = new Set();

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].some(cell => typeof cell === 'string' && cell.includes('CONTRIBUYENTE'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Fallback for some sheets like VIGENCIA EXPIRADA or others that might use "NOMBRE"
      for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some(cell => typeof cell === 'string' && (cell.includes('NOMBRE') || cell.includes('PAGOS DE')))) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex !== -1) {
      const rows = data.slice(headerRowIndex + 1);
      rows.forEach(row => {
        const name = row[1];
        const code = row[2];
        const address = row[3];

        if (name && typeof name === 'string' && name.trim() !== '' && code) {
          const cleanCode = String(code).trim();
          if (!seenCodes.has(cleanCode)) {
            allTaxpayers.push({
              name: name.trim(),
              taxpayer_number: cleanCode,
              address: address ? String(address).trim() : 'ALMIRANTE',
              category: sheetName
            });
            seenCodes.add(cleanCode);
          }
        }
      });
    }
  });

  console.log(`Total contribuyentes únicos encontrados: ${allTaxpayers.length}`);
  console.log('Muestra (primeros 5):');
  console.log(allTaxpayers.slice(0, 5));
}

process();
