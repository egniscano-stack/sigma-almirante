
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function finalCleanup() {
  console.log('--- Limpieza Final y Re-numeración Robusta ---');

  // Fetch ALL taxpayers
  const { data: allTaxpayers, error: fetchError } = await supabase
    .from('taxpayers')
    .select('id, name')
    .order('name', { ascending: true });

  if (fetchError) {
    console.error('Error al obtener contribuyentes:', fetchError.message);
    return;
  }

  console.log(`Procesando ${allTaxpayers.length} registros...`);

  // We'll update them in batches of 10 to be safer
  const total = allTaxpayers.length;
  for (let i = 0; i < total; i++) {
    const tp = allTaxpayers[i];
    const officialNumber = `2026-${i + 1}`;
    
    // Using update without Promise.all to ensure we don't overwhelm the connection
    const { error: updateError } = await supabase
      .from('taxpayers')
      .update({ taxpayer_number: officialNumber })
      .eq('id', tp.id);

    if (updateError) {
      console.error(`Error en [${officialNumber}] ${tp.name}:`, updateError.message);
    } else {
      if (i % 50 === 0) {
        process.stdout.write('.');
      }
    }
  }

  console.log('\n--- Verificación Final ---');
  const { data: remainingTemp } = await supabase
    .from('taxpayers')
    .select('id')
    .like('taxpayer_number', 'TEMP-%');

  if (remainingTemp && remainingTemp.length > 0) {
    console.log(`¡ADVERTENCIA! Aún quedan ${remainingTemp.length} registros con TEMP.`);
  } else {
    console.log('¡ÉXITO! Todos los registros tienen ahora su número 2026-X oficial.');
  }
}

finalCleanup();
