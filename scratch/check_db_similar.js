import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const terms = [
  'JOSE LUIS',
  'DON JORGE',
  'ANTONIO',
  'RED CONTROL',
  'PANAMA PEST'
];

async function check() {
  console.log('--- Buscando términos similares en la DB ---');
  for (const term of terms) {
    const { data, error } = await supabase
      .from('taxpayers')
      .select('*')
      .ilike('name', `%${term}%`);
    
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log(`Búsqueda para "${term}": Encontrados ${data.length}`);
      data.forEach(d => {
        console.log(`  - ID: ${d.id}, Name: ${d.name}, Number: ${d.taxpayer_number}, Balance: ${d.balance}, Codes: ${JSON.stringify(d.selected_tax_codes)}, Cat: ${d.commercial_category}`);
      });
    }
  }
}

check();
