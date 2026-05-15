
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const VIGENCIA_FILE = '/Users/egniscanorodrigues/Desktop/municipio de almirante/Vigencia expirada.xlsx';

async function finalReorg() {
    console.log('--- SIGMA FINAL REORGANIZATION (CORRECT 2-PASS) START ---');
    
    const workbook = XLSX.readFile(VIGENCIA_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const vigenciaData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const vigenciaNames = new Set();
    
    vigenciaData.forEach(row => {
        const name = row[0]?.toString().trim().toUpperCase();
        if (name && name !== 'CONTRIBUYENTE' && name !== 'NOMBRE') {
            vigenciaNames.add(name);
        }
    });

    const { data: taxpayers, error } = await supabase.from('taxpayers').select('*');
    if (error) throw error;
    
    taxpayers.sort((a, b) => a.name.localeCompare(b.name));

    // PASS 1: Temp numbers including all columns
    console.log('Pass 1: Setting temporary numbers...');
    const batchSize = 100;
    for (let i = 0; i < taxpayers.length; i += batchSize) {
        const batch = taxpayers.slice(i, i + batchSize).map(({ created_at, updated_at, ...t }) => ({
            ...t,
            taxpayer_number: `TEMP-${t.id.substring(0, 8)}`
        }));
        const { error: err } = await supabase.from('taxpayers').upsert(batch, { onConflict: 'id' });
        if (err) console.error('Pass 1 Error:', err.message);
    }

    // PASS 2: Final numbers
    console.log('Pass 2: Setting final numbers...');
    const prefix = '2026-MA-';
    const updated = taxpayers.map((t, index) => {
        const cleanName = t.name.trim().toUpperCase();
        const isExpired = vigenciaNames.has(cleanName);
        return {
            ...t,
            taxpayer_number: `${prefix}${String(index + 1).padStart(3, '0')}`,
            status: isExpired ? 'SUSPENDIDO' : 'ACTIVO',
            balance: 0
        };
    });

    for (let i = 0; i < updated.length; i += batchSize) {
        const batch = updated.slice(i, i + batchSize).map(({ created_at, updated_at, ...rest }) => rest);
        const { error: err } = await supabase.from('taxpayers').upsert(batch, { onConflict: 'id' });
        if (err) console.error('Pass 2 Error:', err.message);
        console.log(`Processed ${Math.min(i + batchSize, updated.length)} / ${updated.length}`);
    }

    console.log('--- SIGMA FINAL REORGANIZATION COMPLETE ---');
}

finalReorg().catch(console.error);
