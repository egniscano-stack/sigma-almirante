
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/CONTROL DE PLACAS  SHANTAL.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

function excelDateToISO(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const clean = serial.trim().replace(/\s+/g, '');
    if (clean === '') return null;
    const parts = clean.split('/');
    if (parts.length === 3) {
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d}`;
    }
    if (clean.includes('-')) {
       const p = clean.split('-');
       if (p.length === 3) {
         let y = p[0];
         let m = p[1].replace(/^0+/, '').substring(0, 2).padStart(2, '0');
         if (m === '00') m = '01';
         let d = p[2].replace(/^0+/, '').substring(0, 2).padStart(2, '0');
         // Fix April 31 etc.
         if (m === '04' && parseInt(d) > 30) d = '30';
         if (m === '06' && parseInt(d) > 30) d = '30';
         if (m === '09' && parseInt(d) > 30) d = '30';
         if (m === '11' && parseInt(d) > 30) d = '30';
         if (m === '02' && parseInt(d) > 28) d = '28';

         return `${y}-${m}-${d}`;
       }
    }
    return null;
  }
  try {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch (e) { return null; }
}

async function importPlacasSequential() {
  console.log('--- Iniciando Importación Unificada de Placas (V5 - Continuity & File Date) ---');
  if (!fs.existsSync(filePath)) {
    console.error('Archivo no encontrado:', filePath);
    return;
  }

  console.log('Cargando contribuyentes existentes...');
  const { data: existing, error: fetchErr } = await supabase.from('taxpayers').select('*');
  if (fetchErr) {
    console.error('Error cargando existentes:', fetchErr.message);
    return;
  }
  
  const existingByDoc = new Map();
  const existingByName = new Map();
  const existingByNum = new Map();
  
  existing.forEach(t => {
    if (t.doc_id) existingByDoc.set(t.doc_id.trim().toUpperCase(), t);
    existingByName.set(t.name.trim().toUpperCase(), t);
    existingByNum.set(t.taxpayer_number, t);
  });

  // Find max sequence for continuity
  const nums = existing
    .map(t => t.taxpayer_number)
    .filter(n => n && n.startsWith('2026-MA-'))
    .map(n => parseInt(n.split('-')[2]))
    .filter(n => !isNaN(n));
  let currentSeq = Math.max(...nums, 0) + 1;
  console.log(`Próximo número correlativo: 2026-MA-${currentSeq.toString().padStart(3, '0')}`);

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  const plateGroups = new Map();

  workbook.SheetNames.forEach(sheetName => {
    if (sheetName === 'Hoja1' || sheetName === 'VIGENCIA EXPIRADA') return;
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    let dateIdx = -1, nameIdx = -1, cedulaIdx = -1, amountIdx = -1, plateIdx = -1, phoneIdx = -1;
    const headerRow = rows[5];
    if (!headerRow) return;

    headerRow.forEach((cell, idx) => {
      if (!cell) return;
      const val = String(cell).toUpperCase().trim();
      if (val.includes('FECHA')) dateIdx = idx;
      if (val.includes('NOMBRE')) nameIdx = idx;
      if (val.includes('CEDULA') || val.includes('CEDULO')) cedulaIdx = idx;
      if (val.includes('PAGA') || val.includes('PAGO')) amountIdx = idx;
      if (val.includes('PLACA')) plateIdx = idx;
      if (val.includes('TELF')) phoneIdx = idx;
    });

    if (nameIdx === -1 || plateIdx === -1) return;

    for (let i = 6; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[nameIdx] || !row[plateIdx]) continue;

      const name = String(row[nameIdx]).trim();
      const plate = String(row[plateIdx]).trim().toUpperCase().replace(/\s+/g, '');
      const docId = row[cedulaIdx] ? String(row[cedulaIdx]).trim().toUpperCase() : null;
      
      if (name === '' || plate === '' || name.toUpperCase().includes('TOTAL')) continue;

      const key = docId || name.toUpperCase();
      if (!plateGroups.has(key)) {
        plateGroups.set(key, { name, doc_id: docId, plates: [], phone: row[phoneIdx] ? String(row[phoneIdx]).trim() : null, date: excelDateToISO(row[dateIdx]), totalAmount: 0 });
      }
      
      const group = plateGroups.get(key);
      if (!group.plates.some(p => p.plate === plate)) {
        let amount = 0;
        if (row[amountIdx]) {
          const amtStr = String(row[amountIdx]).replace(/B\/\.?\s?/, '').replace(',', '').trim();
          amount = parseFloat(amtStr) || 0;
        }
        group.plates.push({ 
            plate, 
            brand: 'Vehículo', 
            model: 'Importado', 
            color: 'N/A', 
            chassisSerial: 'N/A', 
            hasTransferDocuments: false, 
            yearlyAmount: amount 
        });
        group.totalAmount += amount;
      }
    }
  });

  const finalUpdateMap = new Map();
  
  for (const [key, group] of plateGroups.entries()) {
    let match = null;
    if (group.doc_id) match = existingByDoc.get(group.doc_id);
    if (!match) match = existingByName.get(group.name.toUpperCase());

    if (match) {
      const existingVehicles = Array.isArray(match.vehicles) ? match.vehicles : [];
      const newVehicles = [...existingVehicles];
      group.plates.forEach(p => { 
          const existingIdx = newVehicles.findIndex(ev => ev.plate === p.plate);
          if (existingIdx === -1) {
            newVehicles.push(p); 
          } else {
              newVehicles[existingIdx] = { ...newVehicles[existingIdx], ...p };
          }
      });

      const tpNum = match.taxpayer_number;
      // If it was a 'PLC-' number, we change it for continuity if it's the right moment
      // Actually, better to keep the same taxpayer_number if it already exists to avoid duplicate entries during upsert
      
      finalUpdateMap.set(tpNum, {
        id: match.id,
        taxpayer_number: tpNum,
        type: match.type || 'PLACA',
        name: match.name,
        status: match.status || 'ACTIVO',
        doc_id: match.doc_id,
        address: match.address || 'ALMIRANTE',
        vehicles: newVehicles,
        yearly_amount: group.totalAmount,
        business_start_date: match.business_start_date || group.date,
        created_at: match.created_at || (group.date ? `${group.date}T12:00:00Z` : new Date().toISOString()),
        updated_at: new Date().toISOString()
      });
    } else {
      const tpNum = `2026-MA-${String(currentSeq++).padStart(3, '0')}`;
      finalUpdateMap.set(tpNum, {
        taxpayer_number: tpNum,
        name: group.name,
        type: 'PLACA',
        status: 'ACTIVO',
        doc_id: group.doc_id || tpNum,
        address: 'ALMIRANTE',
        phone: group.phone,
        has_commercial_activity: false,
        has_garbage_service: false,
        business_start_date: group.date,
        yearly_amount: group.totalAmount,
        vehicles: group.plates,
        balance: 0,
        created_at: group.date ? `${group.date}T12:00:00Z` : new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  const updates = Array.from(finalUpdateMap.values());
  console.log(`Sincronizando ${updates.length} registros únicos...`);
  
  const chunkSize = 20;
  let successCount = 0;

  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await supabase.from('taxpayers').upsert(chunk, { onConflict: 'taxpayer_number' });
    if (error) {
      console.error(`Error en chunk ${i}:`, error.message);
      for (const item of chunk) {
        const { error: e } = await supabase.from('taxpayers').upsert(item, { onConflict: 'taxpayer_number' });
        if (e) console.error(`  Error en ${item.name}:`, e.message);
        else successCount++;
      }
    } else {
      successCount += chunk.length;
    }
  }

  console.log(`--- Importación Finalizada: ${successCount} registros procesados con éxito ---`);
}

importPlacasSequential();
