import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('taxpayers').select('id, taxpayer_number, commercial_category, name').eq('commercial_category', 'ABARROTERIA').limit(5);
  console.log('Error:', error);
  console.log(data);
}

check();
