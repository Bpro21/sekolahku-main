import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase.rpc('get_tables'); // Or just a query
    const { data: tables, error: tableError } = await supabase.from('crm_activities').select('id').limit(1);
    if (tableError) {
        console.log('❌ crm_activities error:', tableError.message);
    } else {
        console.log('✅ crm_activities exists');
    }
}
check();
