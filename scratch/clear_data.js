
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log('--- Iniciando limpieza de datos de contribuyentes ---');

  // Order matters due to foreign keys if cascade is not set
  
  // 1. Transactions
  console.log('Eliminando transacciones...');
  const { error: txError } = await supabase.from('transactions').delete().neq('id', '0');
  if (txError) console.error('Error eliminando transacciones:', txError);
  else console.log('Transacciones eliminadas.');

  // 2. Admin Requests
  console.log('Eliminando solicitudes administrativas...');
  const { error: reqError } = await supabase.from('admin_requests').delete().neq('id', '0');
  if (reqError) console.error('Error eliminando solicitudes:', reqError);
  else console.log('Solicitudes eliminadas.');

  // 3. Vehicles (Though taxpayers delete should cascade)
  console.log('Eliminando vehículos...');
  const { error: vError } = await supabase.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (vError) console.error('Error eliminando vehículos:', vError);
  else console.log('Vehículos eliminados.');

  // 4. Taxpayers
  console.log('Eliminando contribuyentes...');
  const { error: tpError } = await supabase.from('taxpayers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (tpError) console.error('Error eliminando contribuyentes:', tpError);
  else console.log('Contribuyentes eliminados.');

  console.log('--- Limpieza completada ---');
}

clearData();
