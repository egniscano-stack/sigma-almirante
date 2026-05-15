import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function resetAllDebts() {
  console.log('--- RESETTING ALL DEBTS AND BALANCES ---');

  // 1. Reset all taxpayer balances to 0 and clear payment dates in the documents JSONB
  const { data: taxpayers, error: fetchError } = await supabase
    .from('taxpayers')
    .select('id, name, commercial_category, documents');

  if (fetchError) {
    console.error('Error fetching taxpayers:', fetchError);
    return;
  }

  console.log(`Processing ${taxpayers.length} records...`);

  for (let i = 0; i < taxpayers.length; i++) {
    const tp = taxpayers[i];
    
    // Clear dates from documents object
    const updatedDocs = { ...(tp.documents || {}) };
    delete updatedDocs.paymentStartDate;
    delete updatedDocs.businessStartDate;

    await supabase
      .from('taxpayers')
      .update({ 
        balance: 0,
        documents: updatedDocs
      })
      .eq('id', tp.id);

    if ((i + 1) % 100 === 0) console.log(`Reset ${i + 1} records...`);
  }

  console.log('✅ All balances reset and dates cleared.');

  console.log('--- REORGANIZING TAXPAYER NUMBERS ---');
  
  const activeTaxpayers = taxpayers
    .filter(t => t.commercial_category !== 'VIGENCIA EXPIRADA')
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Re-assigning numbers for ${activeTaxpayers.length} active taxpayers...`);

  for (let i = 0; i < activeTaxpayers.length; i++) {
    const tp = activeTaxpayers[i];
    const newNumber = `2026-MA-${(i + 1).toString().padStart(3, '0')}`;
    
    await supabase
      .from('taxpayers')
      .update({ taxpayer_number: newNumber })
      .eq('id', tp.id);
      
    if ((i + 1) % 100 === 0) console.log(`Numbered ${i + 1} taxpayers...`);
  }

  console.log('✅ Taxpayer numbers reorganized successfully.');
}

resetAllDebts();
