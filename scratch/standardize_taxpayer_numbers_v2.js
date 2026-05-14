
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

  for (let i = 0; i < taxpayers.length; i++) {
    const tp = taxpayers[i];
    const newNumber = `ALM-${(1001 + i).toString().padStart(4, '0')}`;
    
    const { error: updateError } = await supabase
      .from('taxpayers')
      .update({ taxpayer_number: newNumber })
      .eq('id', tp.id);
      
    if (updateError) {
      console.error(`Error en ${tp.name}:`, updateError.message);
    } else {
      if (i % 50 === 0) process.stdout.write('.');
    }
  }

  console.log('\n--- ¡Estandarización Exitosa! ---');
  console.log('Formato aplicado: ALM-XXXX (ej. ALM-1001, ALM-1002)');
}

standardize();
