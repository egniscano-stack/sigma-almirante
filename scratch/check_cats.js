import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('taxpayers').select('commercial_category, count(*)', { count: 'exact' });
  console.log('Error:', error);
  // group by commercial_category
  const { data: grouped } = await supabase.rpc('get_categories_count'); // if not exists we just fetch all and group
  
  const { data: all } = await supabase.from('taxpayers').select('commercial_category');
  const counts = {};
  all.forEach(a => {
    counts[a.commercial_category] = (counts[a.commercial_category] || 0) + 1;
  });
  console.log(counts);
}

check();
