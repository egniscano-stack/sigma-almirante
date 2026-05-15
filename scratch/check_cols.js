
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { t_name: 'taxpayers' });
  if (error) {
    // Try querying information_schema via RPC if possible
    console.error('RPC failed, trying query...');
    const { data: d2, error: e2 } = await supabase.from('taxpayers').select('*').limit(1);
    console.log('Sample data keys:', d2?.[0] ? Object.keys(d2[0]) : 'None');
    console.log('Sample data documents:', d2?.[0]?.documents);
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
