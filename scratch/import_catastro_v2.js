
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/AÑO 2026 TESORERIA.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAndImport() {
  console.log('--- Limpiando base de datos ---');
  await supabase.from('taxpayers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('--- Procesando Excel V2 ---');
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  const allTaxpayers = [];
  const seenKeys = new Set();

  workbook.SheetNames.forEach(sheetName => {
    if (sheetName.startsWith('Hoja') || sheetName === 'VIGENCIA EXPIRADA') return;

    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON with empty rows handled
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    // Find Header Indices
    let nameIdx = -1;
    let codeIdx = -1;
    let addrIdx = -1;

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const val = cell.toUpperCase().trim();
          if (val.includes('CONTRIBUYENTE') || val === 'NOMBRE') nameIdx = idx;
          if (val.includes('CODIGO') || val === 'CÓDIGO') codeIdx = idx;
          if (val.includes('DIRECCION') || val === 'UBICACION') addrIdx = idx;
        }
      });
      if (nameIdx !== -1 && codeIdx !== -1) break;
    }

    if (nameIdx !== -1) {
      console.log(`Pestaña: ${sheetName} | NameIdx: ${nameIdx}, CodeIdx: ${codeIdx}`);
      
      rows.forEach((row, rowIndex) => {
        const name = row[nameIdx];
        const code = codeIdx !== -1 ? row[codeIdx] : null;
        const addr = addrIdx !== -1 ? row[addrIdx] : 'ALMIRANTE';

        if (name && typeof name === 'string' && name.trim() !== '' && 
            !name.toUpperCase().includes('CONTRIBUYENTE') && 
            !name.toUpperCase().includes('TOTAL') &&
            !name.toUpperCase().includes('PAGOS DE')) {
          
          const cleanName = name.trim();
          const cleanCode = code ? String(code).trim() : `GEN-${cleanName.substring(0,3).toUpperCase()}-${rowIndex}`;
          const key = `${cleanName}-${cleanCode}`;

          if (!seenKeys.has(key)) {
            const isJuridica = /S\.A\.|CORP|INC|EMPRESA|GRUPO|SUPER|INVERSIONES|COMERCIAL|IMPORT/i.test(cleanName);
            
            allTaxpayers.push({
              taxpayer_number: cleanCode,
              name: cleanName,
              type: isJuridica ? 'JURIDICA' : 'NATURAL',
              status: 'ACTIVO',
              doc_id: `SD-${cleanCode}`,
              address: addr ? String(addr).trim() : 'ALMIRANTE',
              has_commercial_activity: true,
              commercial_category: sheetName,
              has_garbage_service: true,
              balance: 0,
              updated_at: new Date().toISOString()
            });
            seenKeys.add(key);
          }
        }
      });
    }
  });

  console.log(`Total contribuyentes a cargar: ${allTaxpayers.length}`);

  const chunkSize = 50;
  for (let i = 0; i < allTaxpayers.length; i += chunkSize) {
    const chunk = allTaxpayers.slice(i, i + chunkSize);
    const { error } = await supabase.from('taxpayers').upsert(chunk, { onConflict: 'taxpayer_number' });
    if (error) console.error(`Error:`, error.message);
  }

  console.log('--- Importación V2 Finalizada ---');
}

cleanAndImport();
