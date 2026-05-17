import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase
    .from('app_users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error.message);
  } else {
    console.log('Current users in app_users:', data);
  }
}

checkUsers();
