import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const mapTaxpayerFromDB = (data) => ({
    id: data.id,
    taxpayerNumber: data.taxpayer_number,
    type: data.type,
    status: data.status,
    docId: data.doc_id,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento,
    phone: data.phone,
    email: data.email,
    hasCommercialActivity: data.has_commercial_activity,
    commercialCategory: data.commercial_category,
    commercialName: data.commercial_name,
    balance: Number(data.balance) || 0,
    hasConstruction: data.has_construction,
    hasGarbageService: data.has_garbage_service,
    vehicles: [],
    createdAt: data.created_at,
    documents: data.documents || {},
    magnitude: data.magnitude,
    selectedTaxCodes: data.selected_tax_codes || [],
    rotuloAmount: Number(data.rotulo_amount) || 0,
    garbageAmount: Number(data.garbage_amount) || 0
});

async function check() {
  try {
    let allData = [];
    let from = 0;
    let to = 999;
    let finished = false;

    while (!finished) {
        const { data, error, count } = await supabase
            .from('taxpayers')
            .select('*', { count: 'exact' })
            .range(from, to);

        if (error) {
            console.error("Error fetching taxpayers:", error);
            throw error;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (count && allData.length >= count) {
                finished = true;
            } else {
                from += 1000;
                to += 1000;
            }
        } else {
            finished = true;
        }
    }
  
    const mapped = allData.map(mapTaxpayerFromDB);
    
    const cleanTaxpayers = (mapped || []).filter(tp => 
      !tp.taxpayerNumber?.includes('RESET-') && 
      !tp.taxpayerNumber?.includes('TEMP-')
    );

    console.log("Original data fetched length:", allData.length);
    console.log("Original mapped length:", mapped.length);
    console.log("Clean taxpayers length:", cleanTaxpayers.length);
    if(cleanTaxpayers.length === 0) {
        console.log("Sample mapped item:", mapped[0]);
    } else {
        console.log("Sample clean taxpayer:", cleanTaxpayers[0]);
    }
  } catch(e) {
      console.error("Caught error:", e);
  }
}

check();
