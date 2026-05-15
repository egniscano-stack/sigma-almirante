
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxssrsjcwenxfukdsfoa.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3Nyc2pjd2VueGZ1a2RzZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzg0MjIsImV4cCI6MjA5NDQxNDQyMn0.ketneNoqaakdx8hE53MSE1dmXghyhToDcoGo6u6kneY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Some projects have this
  if (error) {
     // Try standard select from a meta table if possible, or just catch error
     console.log('Error listing tables via RPC, check manually in dashboard.');
     return;
  }
  console.log('Tables:', data);
}

// Alternatively, let's try to query the public schema tables via a raw query if we could, 
// but we only have the anon key.
// Let's just try to select from the most likely table names to see which ones fail.
async function probeTables() {
    const tables = ['taxpayers', 'transactions', 'admin_requests', 'config', 'users', 'agenda'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('*').limit(1);
        if (error && error.code === '42P01') {
            console.log(`Table '${t}' DOES NOT exist.`);
        } else {
            console.log(`Table '${t}' exists.`);
        }
    }
}

probeTables();
