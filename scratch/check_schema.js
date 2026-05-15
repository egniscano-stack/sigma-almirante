
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'taxpayers' });
  if (error) {
    // If RPC doesn't exist, try a simple select with a limit 1 to see keys
    const { data: sample, error: err2 } = await supabase.from('taxpayers').select('*').limit(1);
    if (err2) {
      console.error('Error fetching sample:', err2);
      return;
    }
    console.log('Sample data keys:', sample[0] ? Object.keys(sample[0]) : 'No data');
    return;
  }
  console.log('Schema:', data);
}

checkSchema();
