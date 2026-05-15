
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mapTaxpayerToDB = (data) => ({
    taxpayer_number: data.taxpayerNumber,
    type: data.type,
    status: data.status,
    doc_id: data.docId,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento,
    phone: data.phone,
    email: data.email,
    has_commercial_activity: data.hasCommercialActivity,
    commercial_category: data.commercialCategory,
    commercial_name: data.commercialName,
    balance: data.balance || 0,
    has_construction: data.hasConstruction,
    has_garbage_service: data.hasGarbageService,
    documents: data.documents || {},
    magnitude: data.magnitude,
    selected_tax_codes: data.selectedTaxCodes || [],
    rotulo_amount: data.rotuloAmount || 0,
    garbage_amount: data.garbageAmount || 0
});

async function testInsert() {
  const taxpayer = {
    taxpayerNumber: "2026-MA-001",
    name: "TEST PERSISTENCE",
    docId: "0-000-000",
    type: "NATURAL",
    status: "ACTIVO",
    address: "TEST ADDRESS"
  };
  
  const dbData = mapTaxpayerToDB(taxpayer);
  console.log('Inserting:', dbData);
  
  const { data, error } = await supabase.from('taxpayers').insert(dbData).select();
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
  }
}

testInsert();
