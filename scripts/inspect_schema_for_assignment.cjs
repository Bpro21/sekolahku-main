
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- Inspecting Leads Table ---');
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .limit(1);

    if (leadsError) {
        console.error('Error fetching leads:', leadsError);
    } else if (leads.length > 0) {
        console.log('Leads columns:', Object.keys(leads[0]));
    } else {
        console.log('Leads table found but empty. Cannot infer columns from data.');
        // Try to insert a dummy lead to see if it works or fails
        console.log('Attempting to check if assigned_to column exists by selecting it specifically...');
        const { error: colError } = await supabase.from('leads').select('assigned_to').limit(1);
        if (colError) console.log('Column assigned_to likely does not exist:', colError.message);
        else console.log('Column assigned_to exists!');
    }

    console.log('\n--- Inspecting App Settings (Admins) ---');
    const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .single();

    if (settingsError) {
        console.error('Error fetching app_settings:', settingsError);
    } else {
        console.log('App Settings Admins:', settings.admins);
    }

    console.log('\n--- Checking for Profiles/Users Table ---');
    const tables = ['profiles', 'users', 'admin_users', 'staff'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`Table '${table}' exists.`);
            if (data && data.length > 0) console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log(`Table '${table}' does not exist or not accessible:`, error.message);
        }
    }
}

inspect();
