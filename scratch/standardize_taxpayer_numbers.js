
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function standardize() {
  console.log('--- Estandarizando Números de Contribuyente (Portal de Almirante) ---');
  
  const { data: taxpayers, error } = await supabase
    .from('taxpayers')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error al obtener contribuyentes:', error.message);
    return;
  }

  console.log(`Procesando ${taxpayers.length} registros...`);

  const updates = taxpayers.map((tp, index) => ({
    id: tp.id,
    taxpayer_number: `ALM-${(1001 + index).toString().padStart(4, '0')}`
  }));

  // Update in chunks
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error: updateError } = await supabase
      .from('taxpayers')
      .upsert(chunk);
      
    if (updateError) {
      console.error(`Error en chunk ${i}:`, updateError.message);
    } else {
      process.stdout.write('.');
    }
  }

  console.log('\n--- ¡Estandarización Exitosa! ---');
  console.log('Formato aplicado: ALM-XXXX (ej. ALM-1001, ALM-1002)');
}

standardize();
