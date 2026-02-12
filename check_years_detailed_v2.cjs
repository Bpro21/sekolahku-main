const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAcademicYearsDetailed() {
    const { data, error } = await supabase.from('academic_years').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkAcademicYearsDetailed();
