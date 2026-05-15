
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }
  console.log('Available buckets:', data.map(b => ({ id: b.id, name: b.name, public: b.public })));
  
  const targetBucket = 'taxpayer-documents';
  const bucketExists = data.some(b => b.id === targetBucket);
  if (!bucketExists) {
    console.log(`Bucket '${targetBucket}' DOES NOT exist.`);
  } else {
    console.log(`Bucket '${targetBucket}' exists.`);
  }
}

checkBuckets();
