import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const mapAdminRequestFromDB = (data) => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requesterName: data.requester_name,
    taxpayerName: data.taxpayer_name,
    description: data.description,
    transactionId: data.transaction_id,
    payload: data.payload,
    totalDebt: Number(data.total_debt) || 0,
    taxpayerId: data.taxpayer_id || data.payload?.id, // Use dedicated column or fallback to payload
    responseNote: data.response_note,
    approvedAmount: Number(data.approved_amount) || 0,
    approvedTotalDebt: Number(data.approved_total_debt) || 0,
    installments: data.installments,
    createdAt: data.created_at
});

const mapTransactionFromDB = (data) => ({
    id: data.id,
    taxpayerId: data.taxpayer_id,
    taxType: data.tax_type,
    amount: Number(data.amount) || 0,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    paymentMethod: data.payment_method,
    tellerName: data.teller_name,
    metadata: data.metadata,
});

async function check() {
  try {
      console.log("Checking App Users...");
      const r1 = await supabase.from('app_users').select('*');
      if(r1.error) throw r1.error;

      console.log("Checking Transactions...");
      const r3 = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if(r3.error) throw r3.error;
      const txs = (r3.data || []).map(mapTransactionFromDB);

      console.log("Checking Admin Requests...");
      const r5 = await supabase.from('admin_requests').select('*').order('created_at', { ascending: false });
      if(r5.error) throw r5.error;
      const reqs = (r5.data || []).map(mapAdminRequestFromDB);
      
      console.log("All success!");
  } catch(e) {
      console.error("Caught error:", e);
  }
}

check();
