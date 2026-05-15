import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error, count } = await supabase
      .from('taxpayers')
      .select('*', { count: 'exact' })
      .range(0, 999);
  
  if (error) {
      console.error("Error:", error);
  } else {
      console.log("Success. Count:", count, "Data length:", data.length);
  }
}

check();
