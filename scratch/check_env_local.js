import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qxmugkwcsxwxrwjshumg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count } = await supabase.from('taxpayers').select('*', { count: 'exact', head: true });
  console.log("Count in .env.local DB:", count);
}
check();
