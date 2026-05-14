
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function excludeVigenciaExpirada() {
  console.log('--- Excluyendo Vigencia Expirada y Re-numerando ---');

  // 1. Identificar y marcar a los de "VIGENCIA EXPIRADA"
  console.log('Marcando registros de Vigencia Expirada con IDs únicos...');
  const { data: vigenciaRecords, error: fetchVigError } = await supabase
    .from('taxpayers')
    .select('id')
    .eq('commercial_category', 'VIGENCIA EXPIRADA');

  if (fetchVigError) {
    console.error('Error obteniendo vigencia expirada:', fetchVigError.message);
    return;
  }

  for (let i = 0; i < vigenciaRecords.length; i++) {
    await supabase
      .from('taxpayers')
      .update({ taxpayer_number: `VIG-EXP-${i + 1}` })
      .eq('id', vigenciaRecords[i].id);
    if (i % 50 === 0) process.stdout.write('v');
  }
  console.log('\nRegistros de Vigencia Expirada marcados.');

  // 2. Obtener todos los contribuyentes QUE NO SEAN "VIGENCIA EXPIRADA"
  const { data: eligible, error: fetchError } = await supabase
    .from('taxpayers')
    .select('id, name')
    .not('commercial_category', 'eq', 'VIGENCIA EXPIRADA')
    .order('name', { ascending: true });

  if (fetchError) {
    console.error('Error obteniendo contribuyentes elegibles:', fetchError.message);
    return;
  }

  console.log(`Paso 1: Reseteando ${eligible.length} registros elegibles a valores temporales...`);
  // Reseteo para evitar conflictos de clave única
  for (let i = 0; i < eligible.length; i++) {
    const tp = eligible[i];
    await supabase
      .from('taxpayers')
      .update({ taxpayer_number: `RESET-ELIG-${tp.id.substring(0,8)}` })
      .eq('id', tp.id);
    if (i % 100 === 0) process.stdout.write('.');
  }

  console.log('\nPaso 2: Asignando nueva secuencia 2026-X (sin Vigencia Expirada)...');
  for (let i = 0; i < eligible.length; i++) {
    const tp = eligible[i];
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

  console.log('\n--- ¡PROCESO COMPLETADO! ---');
  console.log(`Contribuyentes de Vigencia Expirada excluidos.`);
  console.log(`Secuencia 2026-X aplicada a ${eligible.length} contribuyentes activos.`);
}

excludeVigenciaExpirada();
