import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const r1 = await supabase.from('app_users').select('*');
    if(r1.error) throw r1.error;
    const r2 = await supabase.from('taxpayers').select('id').limit(1);
    if(r2.error) throw r2.error;
    const r3 = await supabase.from('transactions').select('id').limit(1);
    if(r3.error) throw r3.error;
    const r4 = await supabase.from('system_config').select('config').limit(1).single();
    if(r4.error && r4.error.code !== 'PGRST116') throw r4.error;
    const r5 = await supabase.from('admin_requests').select('id').limit(1);
    if(r5.error) throw r5.error;
    
    console.log("All DB calls successful");
  } catch(e) {
    console.error("DB Call failed:", e);
  }
}

check();
