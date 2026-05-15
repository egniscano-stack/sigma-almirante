import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log('Testing insert...');
  const { data, error } = await supabase.from('taxpayers').insert({
    taxpayer_number: 'TEST-001',
    type: 'NATURAL',
    status: 'ACTIVO',
    doc_id: '12345',
    name: 'Test',
    address: 'Test',
    corregimiento: 'Almirante (Cabecera)',
    phone: '12345',
    email: 'test@test.com',
    has_commercial_activity: true,
    commercial_category: 'NONE',
    commercial_name: 'Test',
    balance: 0,
    has_construction: false,
    has_garbage_service: false,
    magnitude: 'PEQUEÑO',
    selected_tax_codes: [],
    rotulo_amount: 0,
    garbage_amount: 0
  }).select().single();
  
  if (error) {
    console.error('INSERT ERROR:', error);
  } else {
    console.log('INSERT SUCCESS:', data);
    // clean up
    await supabase.from('taxpayers').delete().eq('id', data.id);
  }
}

testInsert();
