const XLSX = require('/Users/egniscanorodrigues/Downloads/sigma-almirante/node_modules/xlsx/xlsx.js');
const fs = require('fs');
const path = require('path');

// Supabase config
const SUPABASE_URL = 'https://qrblfqscpyrselvfxncr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYmxmcXNjcHlyc2VsdmZ4bmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTMwNzQsImV4cCI6MjA5NDE4OTA3NH0.nZL_2Fv0nkwmUUvIBauAoVAA_bQmaFHjUji8NIQbetM';

const desktopPath = '/Users/egniscanorodrigues/Desktop/municipio de almirante';

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

async function run(fileToImport) {
    try {
        console.log(`Starting CLEAN individual import for: ${fileToImport}...`);
        const existing = await fetchAllExistingTaxpayers();
        const seen = new Set(existing.map(t => `${(t.name||'').trim().toUpperCase()}|${(t.address||'').trim().toUpperCase()}`));
        
        console.log(`Currently in DB: ${existing.length} taxpayers.`);

        const toInsert = [];
        let totalProcessed = 0;

        const categoryClass = getCategory(fileToImport);
        const workbook = XLSX.readFile(path.join(desktopPath, fileToImport));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            let name, address;
            
            // Standardizing for Abarroteria (3 cols) or Bares (4 cols)
            // But we ONLY want name and address.
            if (fileToImport.toLowerCase() === 'bares.xlsx' || row.length === 4) {
                name = (row[1] || '').toString().trim();
                address = (row[3] || 'ALMIRANTE').toString().trim();
            } else {
                name = (row[0] || '').toString().trim();
                address = (row[2] || 'ALMIRANTE').toString().trim();
            }

            if (name.toUpperCase().includes('CONTRIBUYENTE') || name.toUpperCase().includes('NOMBRE')) continue;
            if (!name) continue;

            const key = `${name.toUpperCase()}|${address.toUpperCase()}`;
            if (seen.has(key)) continue;

            seen.add(key);
            totalProcessed++;

            const uniqueSuffix = `${Date.now()}-${totalProcessed}`;
            const taxpayer = {
                name: name,
                taxpayer_number: `2026-${String(existing.length + totalProcessed).padStart(6, '0')}`,
                doc_id: `MUNI-${uniqueSuffix}`, 
                address: address,
                corregimiento: 'Almirante (Cabecera)',
                status: 'ACTIVO',
                type: 'JURIDICA',
                commercial_name: name,
                has_commercial_activity: true,
                commercial_category: categoryClass,
                balance: 0,
                magnitude: categoryClass === 'CLASE_A' ? 'GRANDE' : (categoryClass === 'CLASE_B' ? 'MEDIANO' : 'PEQUEÑO'),
                selected_tax_codes: [], // NO CODES as requested
                documents: {
                    import_source: fileToImport // Still needed for the filter UI to work
                }
            };

            toInsert.push(taxpayer);

            if (toInsert.length >= 50) {
                await insertTaxpayers(toInsert.splice(0, 50));
            }
        }

        if (toInsert.length > 0) {
            await insertTaxpayers(toInsert);
        }

        console.log(`Finished! Successfully added ${totalProcessed} records from ${fileToImport}.`);
    } catch (error) {
        console.error('Run error:', error);
    }
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.log('Usage: node import_single.cjs <filename.xlsx>');
} else {
    run(targetFile);
}
