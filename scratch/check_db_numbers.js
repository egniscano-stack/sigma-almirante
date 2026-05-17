import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- Analizando taxpayer_number en la DB ---');
  const { data, error } = await supabase
    .from('taxpayers')
    .select('taxpayer_number, name')
    .order('taxpayer_number', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Total contribuyentes en DB: ${data.length}`);
  console.log('Top 30 números más altos / extraños:');
  data.slice(0, 50).forEach(d => {
    console.log(`  - Number: "${d.taxpayer_number}", Name: "${d.name}"`);
  });
}

check();
