
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// IMPORTANT: Use .env.local as it overrides .env in Vite
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const list = [
  ["ABDIEL PORRAS", "12.14.02", ""],
  ["ALLAN GRENALD", "12.14.02", "BARRIO FRANCES"],
  ["ANGELICA HOWELL", "12.14.02", "BARRIADA SAN AGUSTIN"],
  ["ANTONIO EVANS", "12.14.02", "Almirante"],
  ["AQUILES QUIROZ", "12.14.02", "ALMIRANTE ZEGLA"],
  ["AURA BARRIOS", "12.14.02", "ALMIRANTE BARRIO FRANCES"],
  ["BAGATRAC", "12.14.02", "ALM. AEREOPUERTO"],
  ["VIGENCIA EXPIRADA 20225", "12.60.10", ""],
  ["BALTIJA, S.A", "12.14.02", "ALMIRANTE CENTRO"],
  ["CARMEN MORALES", "12.14.02", "BARRIADA SAN AGUSTIN"],
  ["CASA CURAL", "12.14.02", "ALMIRANTE"],
  ["CECILIA CASTILLO", "12.14.02", "ALM. CENTRO BARRIADA MIVI"],
  ["CLAUDIO MILLER", "12.14.02", "ALM. 1 MILLA"],
  ["CLEGIO PARROQUIAL LUIS AMIGO", "12.14.02", "ALMIRANTE NUEVO PARAISO"],
  ["CLIFLOR BECKFORD", "12.14.02", "ALMIRANTE ZEGLA"],
  ["DANIEL MURRAY", "12.14.02", "BARRIO FRANCES/TAMPICO"],
  ["ELSA J. ST, ROSE. CEREZO", "12.14.02", "ALM. ZEGLA"],
  ["EDILMA SANCHEZ", "12.14.02", "ALM. AREA HOSPITAL"],
  ["EDMUNDO CONTRERAS", "12.14.02", "BDA. SAN AGUSTIN"],
  ["ERASMO ROMELIS", "12.14.02", "BARRIO FRANCES"],
  ["ERNESTO ROBERTS", "12.14.02", "ALMIRANTE"],
  ["VIGENCIA EXPIRADA 2025", "12.60.10", ""],
  ["FERNANDO MONTENEGRO", "12.14.02", "ALM. ZEGLA"],
  ["GABRIEL ELLINGTON FUNERARIA", "12.14.02", "Almirante"],
  ["GABRIEL ELLINGTON RESIDELCIAL", "12.14.02", "AV.PUERTO"],
  ["GRACIBEL SANCHEZ", "12.14.02", "ALM. 1 MILLA"],
  ["GULLERMO DOENS", "12.14.02", "ALM. ZEGLA"],
  ["HAROLD HEBBERT", "12.14.02", "BARRIO/BARRIO CHINO"],
  ["HILDA BAKER", "12.14.02", "ALM. 1/2 MILLA"],
  ["IGLESIA EVANGELISTA", "12.14.02", "ALM. /AEREOPUERTO"],
  ["JUDITH SERRUT", "12.14.02", "ALM. ZEGLA"],
  ["MARCELINA STWARD", "12.14.02", "ALM. MEDIA MILLA"],
  ["MARTHA MACHAZECK", "12.14.02", "ALM. CENTRO"],
  ["MARVA BURKE", "12.14.02", "ALM. BARRIADA LICHA"]
];

async function run() {
  console.log('--- Importando a la DB CORRECTA (.env.local) ---');
  
  const taxpayers = list.map((item, index) => {
    const name = item[0];
    const code = item[1];
    const addr = item[2];
    
    return {
      taxpayer_number: `${code}-${index + 1}`,
      name: name,
      type: name.includes('S.A') ? 'JURIDICA' : 'NATURAL',
      status: 'ACTIVO',
      doc_id: `SD-${code}-${index + 1}`,
      address: addr || 'ALMIRANTE',
      has_commercial_activity: true,
      commercial_category: 'GENERAL',
      has_garbage_service: true,
      balance: 0,
      updated_at: new Date().toISOString()
    };
  });

  const { error } = await supabase.from('taxpayers').insert(taxpayers);
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('¡Importación Exitosa de 34 registros!');
  }
}

run();
