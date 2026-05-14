
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/AÑO 2026 TESORERIA.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importFull() {
  console.log('--- Iniciando Importación Masiva Almirante V4 ---');
  
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  const taxpayerMap = new Map();

  workbook.SheetNames.forEach(sheetName => {
    if (sheetName.startsWith('Hoja') || sheetName === 'VIGENCIA EXPIRADA') return;

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
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
      if (nameIdx !== -1) break;
    }

    if (nameIdx !== -1) {
      console.log(`Procesando pestaña: ${sheetName}`);
      rows.forEach((row, rowIndex) => {
        const name = row[nameIdx];
        const code = codeIdx !== -1 ? row[codeIdx] : null;
        const addr = addrIdx !== -1 ? row[addrIdx] : 'ALMIRANTE';

        if (name && typeof name === 'string' && name.trim() !== '' && 
            !name.toUpperCase().includes('CONTRIBUYENTE') && 
            !name.toUpperCase().includes('TOTAL') &&
            !name.toUpperCase().includes('PAGOS DE') &&
            !name.toUpperCase().includes('NOMBRE')) {
          
          const cleanName = name.trim();
          const cleanCode = code ? String(code).trim() : `GEN-${sheetName.substring(0,3).toUpperCase()}-${rowIndex}`;
          
          // Uniqueness key: Name + Code to avoid skipping different people with same activity code
          const key = `${cleanName.toLowerCase()}-${cleanCode.toLowerCase()}`;
          
          if (!taxpayerMap.has(key)) {
            const isJuridica = /S\.A\.|CORP|INC|EMPRESA|GRUPO|SUPER|INVERSIONES|COMERCIAL|IMPORT/i.test(cleanName);
            
            taxpayerMap.set(key, {
              taxpayer_number: cleanCode, // Store original code here
              name: cleanName,
              type: isJuridica ? 'JURIDICA' : 'NATURAL',
              status: 'ACTIVO',
              doc_id: `SD-${cleanCode}-${taxpayerMap.size + 1}`, // Unique Doc ID
              address: addr ? String(addr).trim() : 'ALMIRANTE',
              has_commercial_activity: true,
              commercial_category: sheetName,
              has_garbage_service: true,
              balance: 0,
              updated_at: new Date().toISOString()
            });
          }
        }
      });
    }
  });

  const allTaxpayers = Array.from(taxpayerMap.values());
  console.log(`Total contribuyentes únicos detectados: ${allTaxpayers.length}`);

  // Clear current taxpayers first to avoid collisions
  await supabase.from('taxpayers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const chunkSize = 50;
  for (let i = 0; i < allTaxpayers.length; i += chunkSize) {
    const chunk = allTaxpayers.slice(i, i + chunkSize);
    console.log(`Insertando bloque ${i/chunkSize + 1}...`);
    const { error } = await supabase.from('taxpayers').insert(chunk);
    if (error) console.error(`Error:`, error.message);
  }

  console.log('--- Importación V4 Finalizada ---');
}

importFull();
