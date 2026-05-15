import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log(`--- Reorganizando Números de Contribuyentes en ${supabaseUrl} ---`);

  // Fetch all active taxpayers (excluding VIGENCIA EXPIRADA)
  // We'll paginate just in case
  let allActive = [];
  let from = 0;
  let to = 999;
  let finished = false;

  while (!finished) {
      const { data, error, count } = await supabase
          .from('taxpayers')
          .select('id, name')
          .neq('commercial_category', 'VIGENCIA EXPIRADA')
          .order('name', { ascending: true })
          .range(from, to);

      if (error) {
          console.error("Error fetching:", error.message);
          return;
      }

      if (data && data.length > 0) {
          allActive = [...allActive, ...data];
          from += 1000;
          to += 1000;
      } else {
          finished = true;
      }
  }

  console.log(`Total active taxpayers found: ${allActive.length}`);

  // Create updates array
  const updates = [];
  for (let i = 0; i < allActive.length; i++) {
    const num = i + 1;
    // Format: 2026-MA-01, ..., 2026-MA-100
    const formattedNum = num < 10 ? `0${num}` : `${num}`;
    const newNumber = `2026-MA-${formattedNum}`;
    
    updates.push({
      id: allActive[i].id,
      taxpayer_number: newNumber
    });
  }

  console.log(`Starting updates in chunks...`);
  
  // Since we have a UNIQUE constraint on taxpayer_number, and we are changing them all,
  // we might hit a conflict if a new number temporarily matches an old number of another row.
  // To be safe, first we can update them all to a temporary prefix like 'TEMP-MA-xxx'
  // and then update them to the final '2026-MA-xxx'.
  
  console.log("Paso 1: Aplicando prefijo TEMP para evitar colisiones UNIQUE...");
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    await Promise.all(chunk.map(u => 
      supabase.from('taxpayers').update({ taxpayer_number: `TEMP-${u.taxpayer_number}` }).eq('id', u.id)
    ));
    console.log(`Temp chunk ${i} to ${i+chunk.length} completed.`);
  }

  console.log("Paso 2: Aplicando numeración oficial 2026-MA-...");
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    await Promise.all(chunk.map(u => 
      supabase.from('taxpayers').update({ taxpayer_number: u.taxpayer_number }).eq('id', u.id)
    ));
    console.log(`Final chunk ${i} to ${i+chunk.length} completed.`);
  }

  console.log(`¡Actualización de números completada con éxito!`);
}

run();
