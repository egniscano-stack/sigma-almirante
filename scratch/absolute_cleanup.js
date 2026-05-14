
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function absoluteCleanup() {
  console.log('--- Limpieza Absoluta de Números ---');

  // 1. Fetch all
  const { data: taxpayers, error: fetchError } = await supabase
    .from('taxpayers')
    .select('id, name')
    .order('name', { ascending: true });

  if (fetchError) {
    console.error(fetchError);
    return;
  }

  console.log(`Paso 1: Reseteando ${taxpayers.length} registros a valores temporales...`);
  // Use a batch update with a unique suffix
  for (let i = 0; i < taxpayers.length; i++) {
    const tp = taxpayers[i];
    await supabase
      .from('taxpayers')
      .update({ taxpayer_number: `RESET-${tp.id.substring(0,8)}-${i}` })
      .eq('id', tp.id);
    if (i % 100 === 0) process.stdout.write('.');
  }

  console.log('\nPaso 2: Asignando secuencia 2026-X definitiva...');
  for (let i = 0; i < taxpayers.length; i++) {
    const tp = taxpayers[i];
    const official = `2026-${i + 1}`;
    const { error: upError } = await supabase
      .from('taxpayers')
      .update({ taxpayer_number: official })
      .eq('id', tp.id);
    
    if (upError) {
      console.error(`Error en ${official}:`, upError.message);
    } else {
      if (i % 100 === 0) process.stdout.write('.');
    }
  }

  console.log('\n--- ¡CATÁSTRO COMPLETAMENTE NORMALIZADO! ---');
}

absoluteCleanup();
