import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCategory() {
  console.log('Fixing category...');
  const { data, error } = await supabase
    .from('taxpayers')
    .update({ commercial_category: 'ABARROTERIA' })
    .eq('commercial_category', 'ABARROTERÍA');

  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('Update complete.');
  }
}

fixCategory();
