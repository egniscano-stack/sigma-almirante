
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FILES = [
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/ferreteria.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/Gasolinera.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/lava auto.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/legumbreria.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/Otros.xlsx',
    '/Users/egniscanorodrigues/Desktop/municipio de almirante/Parqueo.xlsx'
];

async function runUpdate() {
    console.log('--- SIGMA MASS UPDATE V3 START ---');
    
    const { data: existing, error: fetchError } = await supabase.from('taxpayers').select('*');
    if (fetchError) throw fetchError;
    console.log(`Loaded ${existing.length} existing taxpayers.`);
    
    const nameLookup = new Map();
    existing.forEach(t => {
        const cleanName = t.name.trim().toUpperCase();
        if (!nameLookup.has(cleanName)) {
            nameLookup.set(cleanName, t);
        }
    });

    const toUpdate = new Map();
    const toInsert = new Map();

    for (const filePath of FILES) {
        const fileName = filePath.split('/').pop();
        console.log(`Processing ${fileName}...`);
        
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let nameCol = -1;
        let codeCol = -1;
        let addrCol = -1;

        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            row.forEach((cell, idx) => {
                const s = cell?.toString().toUpperCase().trim();
                if (s === 'CONTRIBUYENTE' || s === 'NOMBRE') nameCol = idx;
                if (s === 'CODIGO' || s === 'CÓDIGO') codeCol = idx;
                if (s === 'DIRECCION' || s === 'DIRECCIÓN' || s === 'UBICACION') addrCol = idx;
            });
            if (nameCol !== -1 && codeCol !== -1) break;
        }

        if (nameCol === -1) nameCol = 0;
        if (codeCol === -1) codeCol = 1;
        if (addrCol === -1) addrCol = 2;

        console.log(`  Columns found: Name=${nameCol}, Code=${codeCol}, Addr=${addrCol}`);

        let currentTarget = null;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const name = row[nameCol]?.toString().trim().toUpperCase();
            const code = row[codeCol]?.toString().trim();
            const address = row[addrCol]?.toString().trim();
            
            if (name === 'CONTRIBUYENTE' || name === 'NOMBRE') continue;
            if (!name && !code && !address) continue;

            if (name && name.length > 3) {
                if (nameLookup.has(name)) {
                    const dbRecord = nameLookup.get(name);
                    currentTarget = toUpdate.get(dbRecord.id) || { ...dbRecord };
                    if (!currentTarget.selected_tax_codes) currentTarget.selected_tax_codes = [];
                    if (code && !currentTarget.selected_tax_codes.includes(code)) {
                        currentTarget.selected_tax_codes.push(code);
                    }
                    if (address && (!currentTarget.address || currentTarget.address.length < 5)) {
                        currentTarget.address = address;
                    }
                    toUpdate.set(dbRecord.id, currentTarget);
                } else {
                    currentTarget = toInsert.get(name) || {
                        name: name,
                        address: address || 'ALMIRANTE',
                        type: 'NATURAL',
                        status: 'ACTIVO',
                        selected_tax_codes: [],
                        documents: { import_source: fileName },
                        taxpayer_number: `2026-MA-NEW-${Math.floor(1000 + Math.random() * 9000)}`,
                        balance: 0,
                        doc_id: `PEND-${name.substring(0, 10)}-${Math.floor(1000 + Math.random() * 9000)}`
                    };
                    if (code && !currentTarget.selected_tax_codes.includes(code)) {
                        currentTarget.selected_tax_codes.push(code);
                    }
                    toInsert.set(name, currentTarget);
                }
            } else if (currentTarget && code) {
                if (!currentTarget.selected_tax_codes.includes(code)) {
                    currentTarget.selected_tax_codes.push(code);
                }
            }
        }
    }

    console.log(`Detected: ${toUpdate.size} updates, ${toInsert.size} new.`);

    const updateList = Array.from(toUpdate.values());
    for (let i = 0; i < updateList.length; i += 100) {
        const batch = updateList.slice(i, i + 100).map(({ created_at, updated_at, ...rest }) => rest);
        const { error } = await supabase.from('taxpayers').upsert(batch, { onConflict: 'id' });
        if (error) console.error('Update Error:', error.message);
    }

    const insertList = Array.from(toInsert.values());
    for (let i = 0; i < insertList.length; i += 100) {
        const batch = insertList.slice(i, i + 100);
        const { error } = await supabase.from('taxpayers').insert(batch);
        if (error) console.error('Insert Error:', error.message);
    }

    console.log('--- SIGMA MASS UPDATE V3 COMPLETE ---');
}

runUpdate().catch(console.error);
