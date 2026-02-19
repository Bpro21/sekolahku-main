const SUPABASE_URL = 'https://uxqpcizthigbddcbjndi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cXBjaXp0aGlnYmRkY2JqbmRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5MzM0NiwiZXhwIjoyMDg1NzY5MzQ2fQ.Y1OT-VwPsNZf6lMP6dhhfhGM7tEhPWuwb5GpWas5yNI';

const OPTIMIZED_HERO = 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?ixlib=rb-4.0.3&auto=format&fit=crop&w=1280&q=75';

async function fixBranding() {
    console.log('=== Updating Hero BG to Mobile Optimized URL ===');
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=*`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await getRes.json();
    const settings = data[0];
    const newLandingPage = { ...settings.landing_page, hero_bg: OPTIMIZED_HERO };

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.${settings.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ landing_page: newLandingPage })
    });

    if (updateRes.ok) {
        console.log('✅ Updated to 1280px optimized image.');
    }
}
fixBranding();
