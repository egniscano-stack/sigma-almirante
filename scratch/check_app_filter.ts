import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { mapTaxpayerFromDB } from './services/db.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data } = await supabase.from('taxpayers').select('*').range(0, 999);
  const mapped = data.map(mapTaxpayerFromDB);
  
  const cleanTaxpayers = (mapped || []).filter(tp => 
    !tp.taxpayerNumber?.includes('RESET-') && 
    !tp.taxpayerNumber?.includes('TEMP-')
  );

  console.log("Original mapped:", mapped.length);
  console.log("Clean taxpayers:", cleanTaxpayers.length);
  if(cleanTaxpayers.length === 0) {
      console.log("Sample mapped item:", mapped[0]);
  }
}

check();
