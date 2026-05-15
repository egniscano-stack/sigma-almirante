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
  { file: 'almacen.xlsx', category: 'ALMACEN' },
  { file: 'barberia.xlsx', category: 'BARBERIA' },
  { file: 'bares.xlsx', category: 'BARES' },
  { file: 'basura2026.xlsx', category: 'BASURA2026' },
  { file: 'buhoneria.xlsx', category: 'BUHONERIA' },
];

async function run() {
  console.log(`--- Iniciando Carga Masiva en ${supabaseUrl} ---`);

  // We need to fetch the max sequence of taxpayer number so we don't overlap with ABARROTERIA
  // But wait! Each category gets its own prefix usually? 
  // Let's use a unique prefix per file, or just generic "2026-NUM".
  // ABARROTERIA got `2026-AB-XXX`. Let's give ALMACEN `2026-AL-XXX`, etc.
  
  const getPrefix = (cat) => {
      if (cat === 'ALMACEN') return 'AL';
      if (cat === 'BARBERIA') return 'BB';
      if (cat === 'BARES') return 'BR';
      if (cat === 'BASURA2026') return 'BS';
      if (cat === 'BUHONERIA') return 'BH';
      return 'XX';
  };

  const taxpayers = [];
  const seenKeys = new Set();
  
  // Actually, we must be careful with VIGENCIA EXPIRADA seenKeys, they might overlap if they don't have unique names.
  // We'll add index to the key if it's generic.

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
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const name = row[0];
      const addr = row[2];

      if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
        const cleanName = name.trim();
        const cleanAddr = addr ? String(addr).trim().replace(/[\r\n]+/g, ' ') : 'ALMIRANTE';
        
        const isVigenciaExpirada = cleanName.toUpperCase().includes('VIGENCIA EXPIRADA');
        const finalCategory = isVigenciaExpirada ? 'VIGENCIA EXPIRADA' : item.category;
        
        let key = cleanName.toLowerCase();
        if (isVigenciaExpirada) {
            key = key + '-' + item.category + '-' + i; // make it unique
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
