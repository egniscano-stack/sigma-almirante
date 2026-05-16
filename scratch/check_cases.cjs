
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSpecifics() {
  console.log("Revisando casos específicos...");
  const { data, error } = await supabase
    .from('taxpayers')
    .select('*')
    .or('name.ilike.%ABDIEL PORRAS%,name.ilike.%FONG MING LEE%');

  if (error) {
    console.error(error);
  } else {
    data.forEach(t => {
      console.log(`- ${t.name} (ID: ${t.taxpayer_number}):`);
      console.log(`  Vehículos: ${JSON.stringify(t.vehicles)}`);
      console.log(`  Tipo: ${t.type}`);
    });
  }
}

checkSpecifics();
