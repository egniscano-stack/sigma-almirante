
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/AÑO 2026 TESORERIA.xlsx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importCatastro() {
  console.log('--- Iniciando Importación Real del Catastro 2026 ---');
  
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer);
  
  const allTaxpayers = [];
  const seenCodes = new Set();

  workbook.SheetNames.forEach(sheetName => {
    // Skip empty or utility sheets
    if (sheetName.startsWith('Hoja')) return;

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].some(cell => typeof cell === 'string' && cell.includes('CONTRIBUYENTE'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some(cell => typeof cell === 'string' && (cell.includes('NOMBRE') || cell.includes('PAGOS DE')))) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex !== -1) {
      const rows = data.slice(headerRowIndex + 1);
      rows.forEach(row => {
        const name = row[1];
        let code = row[2];
        const address = row[3];

        if (name && typeof name === 'string' && name.trim() !== '' && name.trim() !== 'CONTRIBUYENTE') {
          const cleanName = name.trim();
          // If code is missing, generate one based on name to keep it unique-ish
          const cleanCode = code ? String(code).trim() : `GEN-${cleanName.substring(0,3)}-${Math.floor(Math.random()*1000)}`;
          
          if (!seenCodes.has(cleanCode)) {
            const isJuridica = /S\.A\.|CORP|INC|EMPRESA|GRUPO|SUPER|INVERSIONES/i.test(cleanName);
            
            allTaxpayers.push({
              taxpayer_number: cleanCode,
              name: cleanName,
              type: isJuridica ? 'JURIDICA' : 'NATURAL',
              status: 'ACTIVO',
              doc_id: `SD-${cleanCode}`, // Sin Documento - Código Municipal
              address: address ? String(address).trim() : 'ALMIRANTE',
              has_commercial_activity: true,
              commercial_category: sheetName,
              has_garbage_service: true,
              balance: 0,
              updated_at: new Date().toISOString()
            });
            seenCodes.add(cleanCode);
          }
        }
      });
    }
  });

  console.log(`Contribuyentes listos para insertar: ${allTaxpayers.length}`);

  // Insert in chunks of 50 to avoid payload limits
  const chunkSize = 50;
  for (let i = 0; i < allTaxpayers.length; i += chunkSize) {
    const chunk = allTaxpayers.slice(i, i + chunkSize);
    console.log(`Insertando bloque ${i/chunkSize + 1}...`);
    const { error } = await supabase.from('taxpayers').upsert(chunk, { onConflict: 'taxpayer_number' });
    if (error) {
      console.error(`Error en bloque ${i/chunkSize + 1}:`, error.message);
    }
  }

  console.log('--- Importación finalizada ---');
}

importCatastro();
