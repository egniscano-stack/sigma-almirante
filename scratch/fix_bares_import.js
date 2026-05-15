
import XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/bares.xlsx';

async function fixBares() {
  console.log('--- Corrigiendo Importación de BARES ---');
  
  if (!fs.existsSync(filePath)) {
    console.error('No se encuentra el archivo bares.xlsx');
    return;
  }

  // 1. Obtener el contador actual para seguir la secuencia 2026-MA-XXX
  const { data: latest } = await supabase
    .from('taxpayers')
    .select('taxpayer_number')
    .like('taxpayer_number', '2026-MA-%')
    .order('taxpayer_number', { ascending: false })
    .limit(1);

  let startNum = 1;
  if (latest && latest.length > 0) {
    const lastNumStr = latest[0].taxpayer_number.split('-')[2];
    startNum = parseInt(lastNumStr) + 1;
  }
  console.log(`Iniciando numeración desde: 2026-MA-${String(startNum).padStart(3, '0')}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  const taxpayers = [];
  let currentNum = startNum;

  rows.forEach((row) => {
    // En bares.xlsx: 0=ID_Viejo, 1=Nombre, 2=Codigo, 3=Direccion
    let name = row[1];
    let addr = row[3] || 'ALMIRANTE';

    if (name && String(name).trim() !== '') {
      const cleanName = String(name).trim().toUpperCase();
      
      if (cleanName.includes('VIGENCIA EXPIRADA') || cleanName.includes('TOTAL') || cleanName === 'NOMBRE') {
        return;
      }

      const tpNumber = `2026-MA-${String(currentNum).padStart(3, '0')}`;
      
      taxpayers.push({
        taxpayer_number: tpNumber,
        name: cleanName,
        type: 'JURIDICA', // Bares suelen ser comerciales
        status: 'ACTIVO',
        doc_id: `ID-BAR-${currentNum}`,
        address: addr,
        has_commercial_activity: true,
        commercial_category: 'BARES',
        selected_tax_codes: [],
        has_garbage_service: true,
        balance: 0,
        documents: { import_source: 'bares.xlsx' }
      });
      currentNum++;
    }
  });

  console.log(`Preparados ${taxpayers.length} bares. Eliminando previos y subiendo...`);

  // Borrar solo bares para re-importar
  await supabase.from('taxpayers').delete().eq('commercial_category', 'BARES');

  const { error } = await supabase.from('taxpayers').insert(taxpayers);
  if (error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.log(`✅ ¡Éxito! Se importaron ${taxpayers.length} bares correctamente.`);
  }
}

fixBares();
