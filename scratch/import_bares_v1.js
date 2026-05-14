
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const baresList = [
  ["BAR 7 ROSAS", "11.25.06", "ALMIRANTE 1 MILLA"],
  ["BAR BRICILDA", "11.25.06", "ALMIRANTE CENTRO"],
  ["VIGENCIA EXPIRADA 2024 (BAR)", "12.60.10", "ALMIRANTE"],
  ["BAR MI BEBE", "11.25.06", "ALMIRANTE"],
  ["BAR EL BAMBÚ #1", "11.25.06", "Almirante Ab. Aero"],
  ["BAR EL BAMBÚ #2", "11.25.06", "AVENIDA EL PUERTO"],
  ["BAR EL GRAN MOSISES", "11.25.26", "ALM. 1/2 MILLA"],
  ["BAR LA AMANECIDA", "11.25.06", "BARRIO FRANCES"],
  ["VIGENCIA EXPIRADA 2025 (BAR)", "12.60.10", "ALMIRANTE"],
  ["BAR LA CUEVA DEL DRAGON", "11.25.06", "ALM. 1/2 MILLA"],
  ["VIGENCIA EXPIRADA 2024-B", "12.60.10", "ALMIRANTE"],
  ["BAR.FREE TIME", "11.25.06", "ALMIRANTE"],
  ["BAR LA F", "11.25.06", "ALM. 1/2 MILLA"],
  ["BAR LA FRANJA", "11.25.06", "ALMIRANTE CENTRO"],
  ["BAR CREW", "12.14.02", "almirante"],
  ["BAR LA RIQUICIMA", "11.25.06", "ALMIRANTE CENTRO"],
  ["BAR LOS ANGELES", "11.25.06", "ALMIRANTE MEDIA MILLA"],
  ["BAR MAR Y LUNA", "11.25.06", "ALMIRANTE ZEGLA"],
  ["BAR CENTRAL VALENCIA # 2", "11.25.06", "ALMIRANTE ZEGLA"],
  ["VIGENCIA EXPIRADA 2024-C", "12.60.10", "ALMIRANTE"],
  ["BAR LAS PALMERA", "11.25.06", "ALMIRANTE"],
  ["SALA DE JUEGO EL REGALON", "11.25.06", "ALMIRANTE"],
  ["BAR BILLAR EL CASIQUE", "11.25.06", "ALMIRANTE CENTRO"],
  ["BAR Y PARRILADA LA PALMITA", "11.25.06", "ALM. 1 MILLA"],
  ["BAR Y RESTAURANTE BAR ANGELA", "11.25.40", "ALM. CENTRO"],
  ["BAR Y RESTAURANTRE PIRATAS", "11.25.06", "ALMIRANTE ZEGLA"],
  ["CENTRAL VALENCIA #1", "11.25.06", "ALM. 1 MILLA"],
  ["CENTRAL VALENCIA #2", "11.25.06", "BARRIO CONEJO"],
  ["COCOS BAR", "11.25.06", "ALM. 1/2 MILLA"],
  ["BAR HERMANOS S", "112506", "ALMIRANTE CENTRO"],
  ["VIGENCIA EXPIRADA 2025-B", "12.60.10", "ALMIRANTE"],
  ["BAR CUBILLA", "11.25.06", "ALM. CENTRO"],
  ["VIGENCIA EXPIRADA 2024-D", "12.60.10", "ALMIRANTE"],
  ["BAR CASINO IBIZA ALMIRANTE", "112506", "almirante centro"],
  ["BAR JOCHOCHI", "11.25.06", "ALMIRANTE"]
];

async function updateBares() {
  console.log('--- Actualizando Bares y Cantinas ---');
  
  // 1. Delete existing ones to avoid duplicates if they were already there from full import
  const { error: delErr } = await supabase
    .from('taxpayers')
    .delete()
    .eq('commercial_category', 'BARES Y CANTINA');
    
  if (delErr) console.error('Error delete:', delErr.message);

  // 2. Prepare new records
  const newBares = baresList.map((item, index) => {
    const name = item[0];
    const code = item[1];
    const addr = item[2];
    
    return {
      taxpayer_number: `${code}-BAR-${index + 1}`,
      name: name,
      type: 'JURIDICA',
      status: 'ACTIVO',
      doc_id: `SD-BAR-${code}-${index + 1}`,
      address: addr || 'ALMIRANTE',
      has_commercial_activity: true,
      commercial_category: 'BARES Y CANTINA',
      has_garbage_service: true,
      balance: 0,
      updated_at: new Date().toISOString()
    };
  });

  // 3. Insert
  const { error: insErr } = await supabase.from('taxpayers').insert(newBares);
  
  if (insErr) {
    console.error('Error insert:', insErr.message);
  } else {
    console.log('¡Se han cargado correctamente los 35 bares!');
  }
}

updateBares();
