
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAndRegenerate() {
  console.log('--- Corrigiendo Categorías y Regenerando Números ---');

  // 1. Unificar SUPERMERCADO -> SUPER
  console.log('Unificando SUPERMERCADO en SUPER...');
  const { error: updateError } = await supabase
    .from('taxpayers')
    .update({ commercial_category: 'SUPER' })
    .eq('commercial_category', 'SUPERMERCADO');

  if (updateError) {
    console.error('Error unificando categorías:', updateError.message);
  } else {
    console.log('¡Categorías unificadas!');
  }

  // 2. Regenerar números para TODOS (incluyendo Ferretería)
  console.log('\nRegenerando números de contribuyente (2026-X) por orden alfabético...');
  const { data: allTaxpayers, error: fetchError } = await supabase
    .from('taxpayers')
    .select('id, name')
    .order('name', { ascending: true });

  if (fetchError) {
    console.error('Error obteniendo contribuyentes:', fetchError.message);
    return;
  }

  console.log(`Procesando ${allTaxpayers.length} registros...`);
  
  const chunkSize = 20;
  for (let i = 0; i < allTaxpayers.length; i += chunkSize) {
    const chunk = allTaxpayers.slice(i, i + chunkSize);
    await Promise.all(chunk.map((tp, idx) => 
      supabase.from('taxpayers').update({ taxpayer_number: `2026-${i + idx + 1}` }).eq('id', tp.id)
    ));
    if (i % 100 === 0) process.stdout.write('.');
  }

  console.log('\n--- ¡PROCESO COMPLETADO! ---');
  console.log('Categoría SUPERMERCADO eliminada y convertida a SUPER.');
  console.log('Todos los números (incluyendo Ferretería) han sido recalculados secuencialmente.');
}

fixAndRegenerate();
