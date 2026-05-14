
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { count: tpCount } = await supabase.from('taxpayers').select('*', { count: 'exact', head: true });
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: vCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
  const { count: reqCount } = await supabase.from('admin_requests').select('*', { count: 'exact', head: true });

  console.log(`Taxpayers: ${tpCount}`);
  console.log(`Transactions: ${txCount}`);
  console.log(`Vehicles: ${vCount}`);
  console.log(`Admin Requests: ${reqCount}`);
}

checkData();
