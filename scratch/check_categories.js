import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, count } = await supabase.from('taxpayers').select('commercial_category', { count: 'exact' });
  
  const cats = {};
  data.forEach(d => {
      cats[d.commercial_category] = (cats[d.commercial_category] || 0) + 1;
  });
  console.log("Total Count:", count);
  console.log("Categories Breakdown:", cats);
}

check();
