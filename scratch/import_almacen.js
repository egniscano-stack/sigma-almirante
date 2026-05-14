
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/almacen.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importAlmacen() {
  console.log('--- Importando Almacenes desde XLSX ---');
  
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  await supabase.from('taxpayers').delete().eq('commercial_category', 'ALMACENES');

  const taxpayers = [];
  const seenKeys = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];
    const code = row[1];
    const addr = row[2];

    if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
      const cleanName = name.trim();
      const cleanCode = code ? String(code).trim() : `GEN-ALM-${i}`;
      const key = `${cleanName.toLowerCase()}-${cleanCode.toLowerCase()}`;

      if (!seenKeys.has(key)) {
        taxpayers.push({
          taxpayer_number: `${cleanCode}-ALM-${i}`,
          name: cleanName,
          type: 'JURIDICA',
          status: 'ACTIVO',
          doc_id: `SD-ALM-${cleanCode}-${i}`,
          address: addr ? String(addr).trim() : 'ALMIRANTE',
          has_commercial_activity: true,
          commercial_category: 'ALMACENES',
          has_garbage_service: true,
          balance: 0,
          updated_at: new Date().toISOString()
        });
        seenKeys.add(key);
      }
    }
  }

  const chunkSize = 50;
  for (let i = 0; i < taxpayers.length; i += chunkSize) {
    await supabase.from('taxpayers').insert(taxpayers.slice(i, i + chunkSize));
  }
  console.log(`¡Importación de Almacenes Exitosa! (${taxpayers.length} registros)`);
}

importAlmacen();
