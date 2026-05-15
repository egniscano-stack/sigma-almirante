import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FILE_PATH = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/abarroteria.xlsx';
const CATEGORY = 'ABARROTERÍA';

async function importAbarroteria() {
  console.log(`--- Iniciando Carga de ${CATEGORY} ---`);

  if (!fs.existsSync(FILE_PATH)) {
    console.error(`ERROR: Archivo no encontrado ${FILE_PATH}`);
    return;
  }

  const fileBuffer = fs.readFileSync(FILE_PATH);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  // Clean current category if needed, but let's just insert new ones or maybe delete first?
  // Let's delete existing ones with this category to avoid duplicates, as they want to "create the database" for them.
  console.log(`Limpiando registros existentes de la categoría ${CATEGORY}...`);
  await supabase.from('taxpayers').delete().eq('commercial_category', CATEGORY);

  const taxpayers = [];
  const seenKeys = new Set();
  
  // Also get the current max taxpayer number to generate sequential ones, or just use a generic one.
  // The user says "no utilizes los codigos", so we'll just generate unique `taxpayer_number` values.

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    const name = row[0];
    const addr = row[2]; // address

    if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE') && !name.toUpperCase().includes('VIGENCIA EXPIRADA')) {
      const cleanName = name.trim();
      const cleanAddr = addr ? String(addr).trim().replace(/[\r\n]+/g, ' ') : 'ALMIRANTE';
      
      const key = cleanName.toLowerCase();

      if (!seenKeys.has(key)) {
        taxpayers.push({
          taxpayer_number: `TEMP-ABA-${i}-${Date.now()}`, 
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
      console.error(`Error insertando ${CATEGORY}:`, insError.message);
    } else {
      console.log(`¡${CATEGORY} cargada! (${taxpayers.length} registros)`);
    }
  } else {
    console.log('No se encontraron registros válidos para insertar.');
  }

  // Update sequential official numbers
  console.log('\n--- Regenerando Números de Contribuyente Oficiales ---');
  const { data: allTaxpayers, error: fetchError } = await supabase.from('taxpayers')
    .select('id')
    .eq('commercial_category', CATEGORY)
    .order('name', { ascending: true });
  
  if (fetchError) {
    console.error('Error fetching for regeneration:', fetchError.message);
    return;
  }

  if (allTaxpayers && allTaxpayers.length > 0) {
    for (let i = 0; i < allTaxpayers.length; i += 20) {
      const chunk = allTaxpayers.slice(i, i + 20);
      await Promise.all(chunk.map((tp, idx) => 
        supabase.from('taxpayers').update({ taxpayer_number: `2026-AB-${i + idx + 1}` }).eq('id', tp.id)
      ));
      if (i % 100 === 0) process.stdout.write('.');
    }
    console.log('\nNúmeros regenerados correctamente.');
  }

  console.log('\n--- ¡CARGA FINALIZADA CON ÉXITO! ---');
}

importAbarroteria();
