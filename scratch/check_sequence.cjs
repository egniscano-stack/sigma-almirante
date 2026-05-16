
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSequence() {
  const { data, error } = await supabase
    .from('taxpayers')
    .select('taxpayer_number');

  if (error) {
    console.error(error);
  } else {
    const nums = data
      .map(t => t.taxpayer_number)
      .filter(n => n && n.startsWith('2026-MA-'))
      .map(n => parseInt(n.split('-')[2]))
      .filter(n => !isNaN(n));
    
    console.log("Max sequence:", Math.max(...nums, 0));
  }
}

checkSequence();
