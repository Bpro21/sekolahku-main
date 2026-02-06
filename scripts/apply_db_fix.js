import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function runFix() {
    console.log("🛠️  Starting Robust DB Fix...");

    // 1. Get all leads to check for duplicates
    const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    const phones = new Set();
    const toDelete = [];

    for (const lead of leads || []) {
        if (!lead.phone) continue;
        if (phones.has(lead.phone)) {
            toDelete.push(lead.id);
        } else {
            phones.add(lead.phone);
        }
    }

    console.log("📍 Found " + toDelete.length + " duplicates to remove.");

    for (const id of toDelete) {
        console.log("🗑️  Deleting duplicate lead: " + id);
        await supabase.from('conversations').delete().eq('lead_id', id);
        try {
            await supabase.from('crm_activities').delete().eq('lead_id', id);
        } catch (e) { }
        await supabase.from('leads').delete().eq('id', id);
    }

    // 2. Update existing conversations phone column
    console.log("2. Updating conversation phone numbers...");
    const { data: activeLeads } = await supabase.from('leads').select('id, phone');
    for (const lead of activeLeads || []) {
        // Try update. If column doesn't exist, this fails silently or with error.
        const { error } = await supabase.from('conversations').update({ phone: lead.phone }).eq('lead_id', lead.id);
        if (error) {
            console.log("⚠️  Could not update phone in conversations (column might be missing). Fixing via code in wa-server.js.");
            break;
        }
    }

    console.log("🚀 Robust DB Fix Complete!");
}

runFix();
