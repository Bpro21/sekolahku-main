const SUPABASE_URL = 'https://uxqpcizthigbddcbjndi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cXBjaXp0aGlnYmRkY2JqbmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTMzNDYsImV4cCI6MjA4NTc2OTM0Nn0.iexz28IX4x8hX4_1JnAQeubHKlz3OG6SNEU-DVrCDhw';

async function checkHeroBg() {
    console.log('=== Checking hero_bg in app_settings ===');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=*`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error:', response.status, errorText);
        return;
    }

    const data = await response.json();
    if (data.length > 0) {
        const settings = data[0];
        const heroBg = settings.landing_page?.hero_bg;
        console.log('App Name:', settings.app_name);
        if (heroBg) {
            console.log('Hero BG Prefix:', heroBg.substring(0, 100));
            console.log('Hero BG Length:', heroBg.length);
            if (heroBg.startsWith('data:image')) {
                console.log('⚠️ ALERT: Hero BG is a Base64 string!');
            } else {
                console.log('✅ Hero BG is a URL:', heroBg);
            }
        } else {
            console.log('Hero BG is NOT set (using default)');
        }
    } else {
        console.log('No settings found in app_settings table.');
    }
}

checkHeroBg();
