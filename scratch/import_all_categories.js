
import XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const baseDir = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/';
const filesToImport = [
  'abarroteria.xlsx', 'almacen.xlsx', 'barberia.xlsx', 'bares.xlsx', 
  'buhoneria.xlsx', 'farmacia.xlsx', 'ferreteria.xlsx', 'Gasolinera.xlsx', 
  'lava auto.xlsx', 'legumbreria.xlsx', 'Otros.xlsx', 'Parqueo.xlsx', 
  'restaurante.xlsx', 'ropa americana.xlsx', 'supermercados.xlsx', 
  'Taller.xlsx', 'taxi mar.xlsx', 'basura2026.xlsx',
  'Vigencia expirada.xlsx' // AHORA LO INCLUIMOS
];

async function importAll() {
  console.log('--- Iniciando Importación SIGMA v2 (Incluyendo Vigencias Expiradas) ---');
  
  // 1. Obtener el último número usado para no duplicar si ya se corrió antes
  // Pero como queremos que sea continuo, mejor empezamos desde donde nos quedamos si es posible,
  // o asumimos que vamos a sobreescribir.
  let globalCounter = 1;
  const allTaxpayers = [];

  for (const fileName of filesToImport) {
    const filePath = `${baseDir}${fileName}`;
    if (!fs.existsSync(filePath)) continue;

    const isExpiredFile = fileName === 'Vigencia expirada.xlsx';
    const category = isExpiredFile ? 'VIGENCIA EXPIRADA' : fileName.replace('.xlsx', '').toUpperCase();
    console.log(`📄 Leyendo: ${category}...`);
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    let nameIdx = -1, addrIdx = -1;
    let isInternalExpired = false;

    // Buscar cabeceras
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const val = cell.toUpperCase().trim();
          if (val.includes('CONTRIBUYENTE') || val === 'NOMBRE') nameIdx = idx;
          if (val.includes('DIRECCION') || val === 'UBICACION') addrIdx = idx;
        }
      });
      if (nameIdx !== -1) break;
    }

    if (nameIdx === -1) nameIdx = 0;
    if (addrIdx === -1) addrIdx = 2;

    rows.forEach((row, idx) => {
      if (idx === 0 && !isExpiredFile) return; 

      let name = row[nameIdx];
      let addr = String(row[addrIdx] || 'ALMIRANTE').trim();

      if (name && String(name).trim() !== '') {
        const cleanName = String(name).trim().toUpperCase();
        
        // Detectar si entramos en una sección de vigencia expirada dentro de un archivo normal
        if (cleanName.includes('VIGENCIA EXPIRADA')) {
          isInternalExpired = true;
          return;
        }
        
        if (cleanName.includes('TOTAL') || cleanName.includes('CONTRIBUYENTE') || cleanName === 'NOMBRE') {
          return;
        }

        const isActuallyExpired = isExpiredFile || isInternalExpired;
        
        // El número 2026-MA-XXX solo para contribuyentes activos
        let tpNumber;
        if (isActuallyExpired) {
          tpNumber = `EXP-${category.substring(0,3)}-${idx}-${Math.floor(Math.random()*1000)}`;
        } else {
          tpNumber = `2026-MA-${String(globalCounter).padStart(3, '0')}`;
          globalCounter++;
        }
        
        allTaxpayers.push({
          taxpayer_number: tpNumber,
          name: cleanName,
          type: cleanName.includes('S.A') || cleanName.includes('INC') ? 'JURIDICA' : 'NATURAL',
          status: isActuallyExpired ? 'SUSPENDIDO' : 'ACTIVO',
          doc_id: `ID-${tpNumber}`,
          address: addr === 'undefined' ? 'ALMIRANTE' : addr,
          has_commercial_activity: true,
          commercial_category: category,
          selected_tax_codes: [],
          has_garbage_service: true,
          balance: 0,
          documents: { import_source: fileName, is_expired: isActuallyExpired }
        });
      }
    });
  }

  console.log(`\n🚀 Preparados ${allTaxpayers.length} registros totales. Subiendo...`);

  // Limpiar antes de subir para evitar duplicados si el usuario no limpió
  console.log('Limpiando base de datos para evitar duplicados...');
  await supabase.from('taxpayers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const chunkSize = 100;
  for (let i = 0; i < allTaxpayers.length; i += chunkSize) {
    const chunk = allTaxpayers.slice(i, i + chunkSize);
    const { error } = await supabase.from('taxpayers').insert(chunk);
    if (error) {
      console.error(`❌ Error en bloque ${i}: ${error.message}`);
    } else {
      console.log(`✅ Subido bloque ${i / chunkSize + 1} (${chunk.length} registros)`);
    }
  }

  console.log('\n--- Importación COMPLETA con Vigencias Expiradas finalizada ---');
}

importAll();
