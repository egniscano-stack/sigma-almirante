import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FILE_PATH = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/abarroteria.xlsx';
const CATEGORY = 'ABARROTERIA'; 

async function run() {
  console.log(`--- Iniciando Carga en ${supabaseUrl} ---`);

  const fileBuffer = fs.readFileSync(FILE_PATH);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  console.log(`Limpiando tabla...`);
  await supabase.from('taxpayers').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 

  const taxpayers = [];
  const seenKeys = new Set();
  
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    const name = row[0];
    const addr = row[2];

    if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
      const cleanName = name.trim();
      const cleanAddr = addr ? String(addr).trim().replace(/[\r\n]+/g, ' ') : 'ALMIRANTE';
      const key = cleanName.toLowerCase();

      if (!seenKeys.has(key)) {
        taxpayers.push({
          taxpayer_number: `2026-AB-${taxpayers.length + 1}`, 
          name: cleanName,
          type: 'JURIDICA',
          status: 'ACTIVO',
          address: cleanAddr,
          doc_id: `SD-ABA-${i}`,
          has_commercial_activity: true,
          commercial_category: CATEGORY,
          has_garbage_service: true,
          balance: 0,
          updated_at: new Date().toISOString()
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
      // Fallback: Check if there's any other missing column by doing a test insert
    } else {
      console.log(`¡Cargada! (${taxpayers.length} registros)`);
    }
  }
}

run();
