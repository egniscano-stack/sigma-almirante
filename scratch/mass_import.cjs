const XLSX = require('/Users/egniscanorodrigues/Downloads/sigma-almirante/node_modules/xlsx/xlsx.js');
const fs = require('fs');
const path = require('path');

// Supabase config
const SUPABASE_URL = 'https://qrblfqscpyrselvfxncr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYmxmcXNjcHlyc2VsdmZ4bmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTMwNzQsImV4cCI6MjA5NDE4OTA3NH0.nZL_2Fv0nkwmUUvIBauAoVAA_bQmaFHjUji8NIQbetM';

const desktopPath = '/Users/egniscanorodrigues/Desktop/municipio de almirante';
const files = fs.readdirSync(desktopPath).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

async function fetchAllExistingTaxpayers() {
    let all = [];
    let from = 0;
    let finished = false;
    while (!finished) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/taxpayers?select=name,address,taxpayer_number&offset=${from}&limit=1000`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'count=exact'
            }
        });
        const data = await response.json();
        all = all.concat(data);
        const range = response.headers.get('content-range');
        if (!range) { finished = true; break; }
        const total = parseInt(range.split('/')[1]);
        if (all.length >= total || data.length === 0) finished = true;
        else { from += 1000; }
    }
    return all;
}

async function insertTaxpayers(taxpayers) {
    if (taxpayers.length === 0) return;
    await fetch(`${SUPABASE_URL}/rest/v1/taxpayers`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(taxpayers)
    });
}

function getCategory(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('supermercado') || name.includes('gasolinera') || name.includes('banco')) return 'CLASE_A';
    if (name.includes('abarroteria') || name.includes('almacen') || name.includes('farmacia') || name.includes('restaurante')) return 'CLASE_B';
    return 'CLASE_C';
}

async function run() {
    try {
        console.log('Fetching ALL existing taxpayers...');
        const existing = await fetchAllExistingTaxpayers();
        const seen = new Set(existing.map(t => `${(t.name||'').trim().toUpperCase()}|${(t.address||'').trim().toUpperCase()}`));
        
        console.log(`Currently in DB: ${existing.length} taxpayers.`);

        const toInsert = [];
        let totalProcessed = 0;

        for (const file of files) {
            if (file === 'ESTRUCTURA TRIBUTARIA.xlsx' || file === 'AÑO 2026 TESORERIA.xlsx') continue;
            
            console.log(`Processing file: ${file}...`);
            const categoryClass = getCategory(file);
            const workbook = XLSX.readFile(path.join(desktopPath, file));
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            for (let i = 1; i < rows.length; i++) { // Start at 1 to catch headers just in case
                const row = rows[i];
                if (!row || row.length === 0) continue;

                let name, code, address;
                
                if (file.toLowerCase() === 'bares.xlsx') {
                    // Bares always uses col 1 for Name, col 2 for Code
                    name = (row[1] || '').toString().trim();
                    code = (row[2] || '').toString().trim();
                    address = (row[3] || 'ALMIRANTE').toString().trim();
                } else if (typeof row[0] === 'number' || (row[0] === null && typeof row[1] === 'string' && row[1].includes(' '))) {
                    name = (row[1] || '').toString().trim();
                    code = (row[2] || '').toString().trim();
                    address = (row[3] || 'ALMIRANTE').toString().trim();
                } else {
                    name = (row[0] || '').toString().trim();
                    code = (row[1] || '').toString().trim();
                    address = (row[2] || 'ALMIRANTE').toString().trim();
                }

                // Skip headers
                if (name.toUpperCase().includes('CONTRIBUYENTE') || name.toUpperCase().includes('NOMBRE')) continue;
                if (!name && !code) continue;

                const key = `${name.toUpperCase()}|${address.toUpperCase()}`;
                if (name && seen.has(key)) continue;

                seen.add(key);
                totalProcessed++;

                const uniqueSuffix = `${Date.now()}-${totalProcessed}`;
                const taxpayer = {
                    name: name || `S/N - ${code}`,
                    taxpayer_number: `2026-${String(existing.length + totalProcessed).padStart(6, '0')}`,
                    doc_id: `MUNI-${uniqueSuffix}`, 
                    address: address,
                    corregimiento: 'Almirante (Cabecera)',
                    status: file === 'Vigencia expirada.xlsx' || name.includes('VIGENCIA EXPIRADA') ? 'SUSPENDIDO' : 'ACTIVO',
                    type: 'JURIDICA',
                    commercial_name: name,
                    has_commercial_activity: true,
                    commercial_category: categoryClass,
                    balance: 0,
                    magnitude: categoryClass === 'CLASE_A' ? 'GRANDE' : (categoryClass === 'CLASE_B' ? 'MEDIANO' : 'PEQUEÑO'),
                    selected_tax_codes: code ? [code] : [],
                    documents: {
                        import_source: file,
                        municipal_code: code
                    }
                };

                toInsert.push(taxpayer);

                if (toInsert.length >= 50) {
                    await insertTaxpayers(toInsert.splice(0, 50));
                }
            }
        }

        if (toInsert.length > 0) {
            await insertTaxpayers(toInsert);
        }

        console.log(`Finished! Successfully added ${totalProcessed} new records.`);
    } catch (error) {
        console.error('Run error:', error);
    }
}

run();
