import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertUsers() {
  const users = [
    {
      username: 'contabilidad',
      name: 'Finanzas y Contabilidad',
      role: 'CONTABILIDAD',
      password: 'contabilidad123'
    },
    {
      username: 'planilla',
      name: 'Recursos Humanos y Planilla',
      role: 'PLANILLA',
      password: 'planilla123'
    }
  ];

  for (const user of users) {
    console.log(`Inserting ${user.username}...`);
    const { data, error } = await supabase
      .from('app_users')
      .upsert(user);

    if (error) {
      console.error(`Error inserting ${user.username}:`, error.message);
    } else {
      console.log(`Successfully upserted ${user.username}!`);
    }
  }
}

insertUsers();
