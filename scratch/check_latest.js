
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLatestTaxpayer() {
  const { data, error } = await supabase.from('taxpayers').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) {
    console.error('Error:', error);
    return;
  }
  if (data && data[0]) {
    console.log('Latest Taxpayer:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No taxpayers found.');
  }
}

checkLatestTaxpayer();
