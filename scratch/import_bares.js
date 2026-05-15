import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DESKTOP_DIR = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante';

const item = { file: 'bares.xlsx', category: 'BARES' };

async function run() {
  console.log(`--- Iniciando Carga Masiva de BARES en ${supabaseUrl} ---`);
  
  const getPrefix = (cat) => 'BR';

  const taxpayers = [];
  const seenKeys = new Set();
  
  const filePath = path.join(DESKTOP_DIR, item.file);
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  let validCount = 0;
  // Bares has no header row if row 0 is data! 
  // Wait, my check showed Row 0 is `[ 249, 'BAR 7 ROSAS', '11.25.06', 'ALMIRANTE 1 MILLA' ]`
  // So data starts at row 0!
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    // For BARES, name is at index 1, address is at index 3
    const name = row[1];
    const addr = row[3];

    if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
      const cleanName = name.trim();
      const cleanAddr = addr ? String(addr).trim().replace(/[\r\n]+/g, ' ') : 'ALMIRANTE';
      
      const isVigenciaExpirada = cleanName.toUpperCase().includes('VIGENCIA EXPIRADA');
      const finalCategory = isVigenciaExpirada ? 'VIGENCIA EXPIRADA' : item.category;
      
      let key = cleanName.toLowerCase();
      if (isVigenciaExpirada) {
          key = key + '-' + item.category + '-' + i; 
      }

      if (!seenKeys.has(key)) {
        validCount++;
        const tNumber = isVigenciaExpirada ? `S/N-${getPrefix(item.category)}-${validCount}` : `2026-${getPrefix(item.category)}-${validCount}`;
        
        taxpayers.push({
          taxpayer_number: tNumber,
          name: cleanName,
          type: 'JURIDICA',
          status: 'ACTIVO',
          address: cleanAddr,
          doc_id: `SD-${getPrefix(item.category)}-${i}`,
          has_commercial_activity: true,
          commercial_category: finalCategory,
          has_garbage_service: true,
          balance: 0,
          updated_at: new Date().toISOString(),
          documents: { import_source: item.file }
        });
        seenKeys.add(key);
      }
    }
  }

  if (taxpayers.length > 0) {
    console.log(`Insertando ${taxpayers.length} registros...`);
    const { error: insError } = await supabase.from('taxpayers').insert(taxpayers);
    if (insError) {
      console.error(`Error insertando:`, insError.message);
    } else {
      console.log(`¡Carga completada! (${taxpayers.length} registros)`);
    }
  } else {
      console.log("No valid rows found.");
  }
}

run();
