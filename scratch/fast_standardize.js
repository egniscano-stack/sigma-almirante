
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fastStandardize() {
  console.log('--- Estandarización Ultra-Rápida (2026-X) ---');
  
  // We can't do complex WITH updates easily via RPC unless we have one, 
  // so we'll do it in a small number of batch updates.
  const { data: taxpayers, error } = await supabase
    .from('taxpayers')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Actualizando ${taxpayers.length} registros...`);

  // We can use upsert if we provide all required fields, but we don't want to fetch them all.
  // Instead, we'll use a Promise.all with chunks.
  const updates = taxpayers.map((tp, i) => ({
    id: tp.id,
    taxpayer_number: `2026-${i + 1}`
  }));

  const chunkSize = 20;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(u => 
      supabase.from('taxpayers').update({ taxpayer_number: u.taxpayer_number }).eq('id', u.id)
    ));
    if (i % 100 === 0) process.stdout.write('.');
  }

  console.log('\n¡Hecho!');
}

fastStandardize();
