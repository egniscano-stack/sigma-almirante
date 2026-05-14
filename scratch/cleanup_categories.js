
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  const categoriesToDelete = ['2021', '2022', '2024', 'ABARROTERIA', 'BASURA 2022'];
  
  console.log('--- Limpiando categorías obsoletas ---');
  
  for (const cat of categoriesToDelete) {
    const { error, count } = await supabase
      .from('taxpayers')
      .delete({ count: 'exact' })
      .eq('commercial_category', cat);
      
    if (error) {
      console.error(`Error eliminando ${cat}:`, error.message);
    } else {
      console.log(`Eliminados ${count} registros de ${cat}`);
    }
  }
  
  console.log('--- Limpieza finalizada ---');
}

cleanup();
