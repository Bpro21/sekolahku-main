const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUnits() {
    const { data, error } = await supabase.from('units').select('*').limit(1);
    if (error) console.error(error);
    else if (data.length > 0) console.log(Object.keys(data[0]));
    else console.log("No data");
}

checkUnits();
