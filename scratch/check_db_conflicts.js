import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- Buscando números conflictivos en la DB ---');
  const { data, error } = await supabase
    .from('taxpayers')
    .select('taxpayer_number, name')
    .or('taxpayer_number.eq.2026-MA-1097,taxpayer_number.eq.2026-MA-1098,taxpayer_number.eq.2026-MA-1099,taxpayer_number.eq.2026-MA-1100,taxpayer_number.eq.2026-MA-1101');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Encontrados conflictivos: ${data.length}`);
  data.forEach(d => {
    console.log(`  - Number: "${d.taxpayer_number}", Name: "${d.name}"`);
  });
}

check();
