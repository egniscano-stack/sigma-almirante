
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FILES = [
    { path: '/Users/egniscanorodrigues/Desktop/municipio de almirante/abarroteria.xlsx', nameKey: '__EMPTY', codeKey: '__EMPTY_1', addrKey: '__EMPTY_2', source: 'abarroteria' },
    { path: '/Users/egniscanorodrigues/Desktop/municipio de almirante/almacen.xlsx', nameKey: '__EMPTY', codeKey: '__EMPTY_1', addrKey: '__EMPTY_2', source: 'almacen' },
    { path: '/Users/egniscanorodrigues/Desktop/municipio de almirante/barberia.xlsx', nameKey: 'CONTRIBUYENTE', codeKey: 'CODIGO', addrKey: 'DIRECCION', source: 'barberia' }
];

async function runUpdate() {
    console.log('--- SIGMA FINAL MASS UPDATE START ---');
    
    const { data: existing, error: fetchError } = await supabase.from('taxpayers').select('*');
    if (fetchError) throw fetchError;
    
    const nameLookup = new Map();
    existing.forEach(t => {
        const cleanName = t.name.trim().toUpperCase();
        if (!nameLookup.has(cleanName)) {
            nameLookup.set(cleanName, t);
        }
    });

    const toUpdate = new Map();
    const toInsert = new Map();

    for (const fileCfg of FILES) {
        console.log(`Reading ${fileCfg.source}.xlsx...`);
        const workbook = XLSX.readFile(fileCfg.path);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        let currentTarget = null;
        
        for (const row of data) {
            const name = row[fileCfg.nameKey]?.toString().trim().toUpperCase();
            const code = row[fileCfg.codeKey]?.toString().trim();
            const address = row[fileCfg.addrKey]?.toString().trim();
            
            if (name === 'CONTRIBUYENTE' || name === 'CONTRIBUYENTE ') continue;
            if (!name && !code && !address) continue;

            if (name) {
                if (nameLookup.has(name)) {
                    const dbRecord = nameLookup.get(name);
                    currentTarget = toUpdate.get(dbRecord.id) || { ...dbRecord };
                    if (!currentTarget.selected_tax_codes) currentTarget.selected_tax_codes = [];
                    if (code && !currentTarget.selected_tax_codes.includes(code)) {
                        currentTarget.selected_tax_codes.push(code);
                    }
                    toUpdate.set(dbRecord.id, currentTarget);
                } else {
                    currentTarget = toInsert.get(name) || {
                        name: name,
                        address: address || 'ALMIRANTE',
                        type: 'NATURAL',
                        status: 'ACTIVO',
                        selected_tax_codes: [],
                        documents: { import_source: `${fileCfg.source}.xlsx` },
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

    console.log(`Summary: ${toUpdate.size} updates, ${toInsert.size} new.`);

    const updateList = Array.from(toUpdate.values());
    for (let i = 0; i < updateList.length; i += 50) {
        const batch = updateList.slice(i, i + 50).map(({ created_at, updated_at, ...rest }) => rest);
        const { error } = await supabase.from('taxpayers').upsert(batch, { onConflict: 'id' });
        if (error) console.error('Update Error:', error.message);
    }

    const insertList = Array.from(toInsert.values());
    if (insertList.length > 0) {
        const { error } = await supabase.from('taxpayers').insert(insertList);
        if (error) console.error('Insert Error:', error.message);
    }

    console.log('--- SIGMA FINAL MASS UPDATE COMPLETE ---');
}

runUpdate().catch(console.error);
