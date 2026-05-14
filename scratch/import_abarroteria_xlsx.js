
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/abarroteria.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importAbarroteria() {
  console.log('--- Importando Abarroterías desde XLSX ---');
  
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  // Clean existing 
  await supabase.from('taxpayers').delete().eq('commercial_category', 'ABARROTERIA');

  const taxpayers = [];
  const seenKeys = new Set();

  // Header is at rows[0], data starts at rows[1]
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];
    const code = row[1];
    const addr = row[2];

    if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
      const cleanName = name.trim();
      const cleanCode = code ? String(code).trim() : `GEN-ABA-${i}`;
      const key = `${cleanName.toLowerCase()}-${cleanCode.toLowerCase()}`;

      if (!seenKeys.has(key)) {
        taxpayers.push({
          taxpayer_number: `${cleanCode}-ABA-${i}`,
          name: cleanName,
          type: 'JURIDICA',
          status: 'ACTIVO',
          doc_id: `SD-ABA-${cleanCode}-${i}`,
          address: addr ? String(addr).trim() : 'ALMIRANTE',
          has_commercial_activity: true,
          commercial_category: 'ABARROTERIA',
          has_garbage_service: true,
          balance: 0,
          updated_at: new Date().toISOString()
        });
        seenKeys.add(key);
      }
    }
  }

  console.log(`Total a insertar: ${taxpayers.length}`);
  const { error } = await supabase.from('taxpayers').insert(taxpayers);
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('¡Importación de Abarrotería Exitosa!');
  }
}

importAbarroteria();
