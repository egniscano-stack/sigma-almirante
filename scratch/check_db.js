import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('taxpayers').select('*').limit(5);
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
  console.log('First:', data ? data[0] : null);
}

check();
