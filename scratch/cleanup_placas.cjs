
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanupPlacas() {
  console.log("Eliminando registros temporales PLC-...");
  const { error } = await supabase
    .from('taxpayers')
    .delete()
    .like('taxpayer_number', 'PLC-%');

  if (error) {
    console.error("Error al eliminar:", error.message);
  } else {
    console.log("Limpieza completada.");
  }
}

cleanupPlacas();
