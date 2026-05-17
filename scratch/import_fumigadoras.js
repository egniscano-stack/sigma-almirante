import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_FILE = '/Users/egniscanorodrigues/Desktop/municipio de almirante/fumigadora.xlsx';

function normalizeName(str) {
  if (!str) return '';
  return str.trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^A-Z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

async function fetchAllTaxpayers() {
  let allData = [];
  let from = 0;
  let to = 999;
  let finished = false;

  while (!finished) {
    const { data, error, count } = await supabase
      .from('taxpayers')
      .select('*', { count: 'exact' })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (count && allData.length >= count) {
        finished = true;
      } else {
        from += 1000;
        to += 1000;
      }
    } else {
      finished = true;
    }
  }
  return allData;
}

async function runImport() {
  console.log('--- INICIANDO IMPORTACIÓN Y UNIFICACIÓN DE FUMIGADORAS (PAGINACIÓN CORREGIDA) ---');

  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`ERROR: No se encontró el archivo Excel en: ${EXCEL_FILE}`);
    process.exit(1);
  }

  // 1. Load ALL existing taxpayers from DB to check for unification
  console.log('Cargando contribuyentes existentes (con paginación)...');
  let existing;
  try {
    existing = await fetchAllTaxpayers();
  } catch (err) {
    console.error('Error cargando contribuyentes:', err.message);
    process.exit(1);
  }

  console.log(`Se cargaron ${existing.length} contribuyentes existentes totales.`);

  const nameLookup = new Map();
  const docLookup = new Map();

  existing.forEach(t => {
    const norm = normalizeName(t.name);
    if (norm && !nameLookup.has(norm)) {
      nameLookup.set(norm, t);
    }
    if (t.doc_id) {
      docLookup.set(t.doc_id.trim().toUpperCase(), t);
    }
  });

  // Calculate the next sequence number for taxpayer_number (Format: 2026-MA-XXX)
  const prefix = '2026-MA-';
  const sequences = existing
    .map(t => t.taxpayer_number)
    .filter(n => n && n.startsWith(prefix))
    .map(n => {
      const parts = n.split('-');
      return parseInt(parts[parts.length - 1]) || 0;
    })
    .filter(n => !isNaN(n));

  let nextSequence = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
  console.log(`Próximo número correlativo de contribuyente: 2026-MA-${String(nextSequence).padStart(3, '0')}`);

  // 2. Parse the Excel file
  console.log(`Leyendo archivo Excel: ${EXCEL_FILE}...`);
  const fileBuffer = fs.readFileSync(EXCEL_FILE);
  const workbook = XLSX.read(fileBuffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  const parsedTaxpayers = [];
  let currentTaxpayer = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const col0 = row[0] ? String(row[0]).trim() : null;
    const col1 = row[1] ? String(row[1]).trim() : null;
    const col2 = row[2] ? String(row[2]).trim() : null;

    if (col1 === '11.25.65') {
      // Main activity row
      currentTaxpayer = {
        name: col0,
        address: col2 || 'ALMIRANTE',
        codes: ['11.25.65']
      };
      parsedTaxpayers.push(currentTaxpayer);
    } else if (col1 === '11.25.30') {
      // Secondary row (signage)
      if (currentTaxpayer) {
        if (col0 && col0 !== 'CONTRIBUYENTE' && col0 !== 'NOMBRE') {
          currentTaxpayer.name = `${currentTaxpayer.name} ${col0}`.trim();
        }
        currentTaxpayer.codes.push('11.25.30');
      }
    }
  }

  console.log(`Parsed ${parsedTaxpayers.length} contribuyentes de fumigadora.xlsx.`);

  const toInsert = [];
  const toUpdate = [];

  for (const parsed of parsedTaxpayers) {
    const cleanName = parsed.name.trim().toUpperCase();
    const norm = normalizeName(cleanName);

    // Look for exact/normalized name match in DB
    let matchedTp = nameLookup.get(norm);

    if (matchedTp) {
      console.log(`\n🔄 [UNIFICAR] Encontrado contribuyente matching: "${matchedTp.name}" para "${parsed.name}"`);
      
      const currentCodes = matchedTp.selected_tax_codes || [];
      const newCodes = [...currentCodes];

      parsed.codes.forEach(code => {
        if (!newCodes.includes(code)) {
          newCodes.push(code);
        }
      });

      // Keep original category if present, otherwise set to FUMIGADORA
      const updatedCategory = (!matchedTp.commercial_category || matchedTp.commercial_category === 'NONE') 
        ? 'FUMIGADORA' 
        : matchedTp.commercial_category;

      toUpdate.push({
        id: matchedTp.id,
        name: matchedTp.name, // Keep existing name
        taxpayer_number: matchedTp.taxpayer_number,
        type: matchedTp.type,
        status: matchedTp.status,
        doc_id: matchedTp.doc_id,
        address: matchedTp.address || parsed.address,
        has_commercial_activity: true,
        commercial_category: updatedCategory,
        selected_tax_codes: newCodes,
        has_garbage_service: matchedTp.has_garbage_service !== undefined ? matchedTp.has_garbage_service : true,
        balance: matchedTp.balance || 0, // Keep their existing balance/debt
        vehicles: matchedTp.vehicles || [],
        documents: {
          ...(matchedTp.documents || {}),
          unified_from_import: 'fumigadora.xlsx',
          unified_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
    } else {
      // New taxpayer
      const generatedNum = `2026-MA-${String(nextSequence++).padStart(3, '0')}`;
      console.log(`\n➕ [CREAR NUEVO] Creando contribuyente "${cleanName}" con número ${generatedNum}`);

      toInsert.push({
        id: crypto.randomUUID(),
        taxpayer_number: generatedNum,
        name: cleanName,
        type: 'JURIDICA',
        status: 'ACTIVO',
        doc_id: `ID-${generatedNum}`,
        address: parsed.address,
        has_commercial_activity: true,
        commercial_category: 'FUMIGADORA',
        selected_tax_codes: [], // "sin codigos" -> empty array
        has_garbage_service: true,
        balance: 0, // "sin deudas" -> balance 0
        vehicles: [],
        documents: {
          import_source: 'fumigadora.xlsx',
          imported_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  // 3. Save updates to Supabase
  if (toUpdate.length > 0) {
    console.log(`\nAplicando ${toUpdate.length} unificaciones en la base de datos...`);
    for (const tp of toUpdate) {
      const { created_at, updated_at, ...updateData } = tp;
      const { error } = await supabase
        .from('taxpayers')
        .update(updateData)
        .eq('id', tp.id);

      if (error) {
        console.error(`❌ Error actualizando a "${tp.name}":`, error.message);
      } else {
        console.log(`✅ Unificado con éxito: "${tp.name}" (Códigos: ${JSON.stringify(tp.selected_tax_codes)})`);
      }
    }
  }

  // 4. Save inserts to Supabase
  if (toInsert.length > 0) {
    console.log(`\nAplicando ${toInsert.length} inserciones en la base de datos...`);
    const { error } = await supabase
      .from('taxpayers')
      .insert(toInsert);

    if (error) {
      console.error('❌ Error insertando nuevos contribuyentes:', error.message);
    } else {
      console.log(`✅ Insertados ${toInsert.length} contribuyentes nuevos con éxito.`);
    }
  }

  console.log('\n--- ¡PROCESO DE IMPORTACIÓN Y UNIFICACIÓN COMPLETADO CON ÉXITO! ---');
}

runImport().catch(console.error);
