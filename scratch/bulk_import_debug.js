
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_DIR = '/Users/egniscanorodrigues/Desktop/municipio de almirante/';

const FILES_TO_IMPORT = [
  { name: 'farmacia.xlsx', category: 'FARMACIA', startRow: 2 },
  { name: 'ferreteria.xlsx', category: 'FERRETERIA', startRow: 2 },
  { name: 'Gasolinera.xlsx', category: 'GASOLINERA', startRow: 2 },
  { name: 'lava auto.xlsx', category: 'LAVA AUTO', startRow: 2 },
  { name: 'legumbreria.xlsx', category: 'LEGUMBRERIA', startRow: 2 },
  { name: 'Otros.xlsx', category: 'OTROS', startRow: 2 },
  { name: 'Parqueo.xlsx', category: 'PARQUEO', startRow: 2 },
  { name: 'ropa americana.xlsx', category: 'ROPA AMERICANA', startRow: 2 },
  { name: 'supermercados.xlsx', category: 'SUPERMERCADO', startRow: 2 },
  { name: 'Taller.xlsx', category: 'TALLER', startRow: 2 },
  { name: 'taxi mar.xlsx', category: 'TAXI MAR', startRow: 2 },
  { name: 'Vigencia expirada.xlsx', category: 'VIGENCIA EXPIRADA', startRow: 2 }
];

async function importAll() {
  console.log('--- Iniciando Carga Masiva Almirante (DEBUG) ---');

  for (const fileInfo of FILES_TO_IMPORT) {
    const filePath = path.join(BASE_DIR, fileInfo.name);
    
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: Archivo no encontrado ${filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    // Clean current category
    const { error: delError } = await supabase.from('taxpayers').delete().eq('commercial_category', fileInfo.category);
    if (delError) console.error('Delete error:', delError);

    const taxpayers = [];
    const seenKeys = new Set();

    for (let i = fileInfo.startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const name = row[0];
      const code = row[1];
      const addr = row[2];

      if (name && typeof name === 'string' && name.trim() !== '' && !name.toUpperCase().includes('CONTRIBUYENTE')) {
        const cleanName = name.trim();
        const cleanCode = code ? String(code).trim() : `GEN-${fileInfo.category.substring(0,3)}-${i}`;
        const key = `${cleanName.toLowerCase()}-${cleanCode.toLowerCase()}`;

        if (!seenKeys.has(key)) {
          taxpayers.push({
            taxpayer_number: '---',
            name: cleanName,
            type: 'JURIDICA',
            status: 'ACTIVO',
            doc_id: `SD-${fileInfo.category.substring(0,3)}-${cleanCode}-${i}`,
            address: addr ? String(addr).trim() : 'ALMIRANTE',
            has_commercial_activity: true,
            commercial_category: fileInfo.category,
            has_garbage_service: true,
            balance: 0,
            updated_at: new Date().toISOString()
          });
          seenKeys.add(key);
        }
      }
    }

    if (taxpayers.length > 0) {
      const { error: insError } = await supabase.from('taxpayers').insert(taxpayers);
      if (insError) {
        console.error(`Error insertando ${fileInfo.category}:`, insError.message);
      } else {
        console.log(`¡${fileInfo.category} cargada! (${taxpayers.length} registros)`);
      }
    }
  }

  console.log('\n--- Regenerando Números de Contribuyente (2026-X) ---');
  const { data: allTaxpayers } = await supabase.from('taxpayers').select('id').order('name', { ascending: true });
  
  if (allTaxpayers) {
    for (let i = 0; i < allTaxpayers.length; i += 20) {
      const chunk = allTaxpayers.slice(i, i + 20);
      await Promise.all(chunk.map((tp, idx) => 
        supabase.from('taxpayers').update({ taxpayer_number: `2026-${i + idx + 1}` }).eq('id', tp.id)
      ));
      if (i % 100 === 0) process.stdout.write('.');
    }
  }

  console.log('\n¡Hecho!');
}

importAll();
