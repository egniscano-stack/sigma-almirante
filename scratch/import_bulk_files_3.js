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

const FILES_TO_PROCESS = [
  { file: 'restaurante.xlsx', category: 'RESTAURANTE', prefix: 'RE' },
  { file: 'ropa americana.xlsx', category: 'ROPA AMERICANA', prefix: 'RA' },
  { file: 'supermercados.xlsx', category: 'SUPERMERCADOS', prefix: 'SU' },
  { file: 'Taller.xlsx', category: 'TALLER', prefix: 'TA' },
  { file: 'taxi mar.xlsx', category: 'TAXI MAR', prefix: 'TM' },
  { file: 'Vigencia expirada.xlsx', category: 'VIGENCIA EXPIRADA', prefix: 'VE' }
];

async function run() {
  console.log(`--- Iniciando Carga Masiva (Fase 3) en ${supabaseUrl} ---`);

  const taxpayers = [];
  const seenKeys = new Set();
  
  // To avoid duplicates across runs if needed, we could fetch existing names, 
  // but let's just use the Set to avoid duplicates within this script execution.

  for (const item of FILES_TO_PROCESS) {
    const filePath = path.join(DESKTOP_DIR, item.file);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found, skipping: ${filePath}`);
        continue;
    }

    console.log(`Processing ${item.file} for category ${item.category}...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    let validCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const name = row[0];
      const addr = item.file === 'Vigencia expirada.xlsx' ? null : row[2];

      if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE') && name.trim().toUpperCase() !== 'NOMBRE') {
        const cleanName = name.trim();
        const cleanAddr = addr ? String(addr).trim().replace(/[\r\n]+/g, ' ') : 'ALMIRANTE';
        
        // If file is "Vigencia expirada.xlsx", everything is VIGENCIA EXPIRADA.
        // Also check string content for other files.
        const isVigenciaExpirada = item.category === 'VIGENCIA EXPIRADA' || cleanName.toUpperCase().includes('VIGENCIA EXPIRADA');
        const finalCategory = isVigenciaExpirada ? 'VIGENCIA EXPIRADA' : item.category;
        
        let key = cleanName.toLowerCase();
        if (isVigenciaExpirada) {
            key = key + '-' + item.category + '-' + i; 
        }

        if (!seenKeys.has(key)) {
          validCount++;
          const tNumber = isVigenciaExpirada ? `S/N-${item.prefix}-${validCount}` : `2026-${item.prefix}-${validCount}`;
          
          taxpayers.push({
            taxpayer_number: tNumber,
            name: cleanName,
            type: 'JURIDICA',
            status: 'ACTIVO',
            address: cleanAddr,
            doc_id: `SD-${item.prefix}-${i}`,
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
  }

  if (taxpayers.length > 0) {
    console.log(`Insertando ${taxpayers.length} registros en total...`);
    // Insert in chunks of 500
    for(let i=0; i<taxpayers.length; i+=500) {
        const chunk = taxpayers.slice(i, i+500);
        const { error: insError } = await supabase.from('taxpayers').insert(chunk);
        if (insError) {
          console.error(`Error insertando chunk ${i}:`, insError.message);
        } else {
          console.log(`Chunk cargado! (${chunk.length} registros)`);
        }
    }
    console.log(`¡Carga masiva completada!`);
  } else {
      console.log("No valid rows found.");
  }
}

run();
