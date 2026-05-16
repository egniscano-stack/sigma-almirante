
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
  const { data, error } = await supabase.from('taxpayers').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in taxpayers:', Object.keys(data[0]));
  } else {
    console.log('No data found in taxpayers to check columns.');
  }
}

probe();
