// Debug Script - Jalankan di browser console (F12 -> Console)
// Untuk mengetahui detail error dari Supabase

const SUPABASE_URL = 'https://uxqpcizthigbddcbjndi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cXBjaXp0aGlnYmRkY2JqbmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5ODczODksImV4cCI6MjA1MzU2MzM4OX0.lZWfbvWFGwJwBtZgPGNzVCjKN2DnCFvHGTlcUb5FJY';

// Test 1: Check units table schema
async function checkUnitsSchema() {
    console.log('=== Checking units table schema ===');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/units?select=*&limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error:', response.status, errorText);
        return;
    }

    const data = await response.json();
    console.log('Units data:', data);
    if (data.length > 0) {
        console.log('Available columns:', Object.keys(data[0]));
    } else {
        console.log('Table is empty. Trying to get column info...');
    }
}

// Test 2: Try to insert test data
async function testInsert() {
    console.log('=== Testing INSERT to units ===');
    const testData = {
        name: 'TEST Unit',
        level: 'SD',
        quota: 10,
        open: true,
        cost_reg: 100000,
        cost_rereg: 500000
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/units`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', responseText);

    if (response.ok) {
        console.log('✅ INSERT SUCCESS!');
        // Delete test data
        const inserted = JSON.parse(responseText);
        if (inserted[0]?.id) {
            await fetch(`${SUPABASE_URL}/rest/v1/units?id=eq.${inserted[0].id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            console.log('Test data deleted');
        }
    } else {
        console.error('❌ INSERT FAILED');
        try {
            const errorJson = JSON.parse(responseText);
            console.error('Error details:', errorJson);
        } catch (e) {
            console.error('Raw error:', responseText);
        }
    }
}

// Test 3: Check RLS status
async function checkRLS() {
    console.log('=== Checking RLS policies (requires database access) ===');
    console.log('RLS check via REST API is limited.');
    console.log('If INSERT fails with 400, likely causes:');
    console.log('1. RLS is still ENABLED');
    console.log('2. Missing required columns');
    console.log('3. Column type mismatch');
}

// Run all tests
async function runDiagnostics() {
    console.log('🔍 Starting Supabase Diagnostics...\n');
    await checkUnitsSchema();
    console.log('\n');
    await testInsert();
    console.log('\n');
    await checkRLS();
    console.log('\n🔍 Diagnostics complete!');
}

runDiagnostics();
