const SUPABASE_URL = 'https://uxqpcizthigbddcbjndi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cXBjaXp0aGlnYmRkY2JqbmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTMzNDYsImV4cCI6MjA4NTc2OTM0Nn0.iexz28IX4x8hX4_1JnAQeubHKlz3OG6SNEU-DVrCDhw';

async function checkAllBase64() {
    console.log('=== Checking ALL Base64 data in app_settings ===');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=*`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();
    if (data.length === 0) { console.log('No settings found'); return; }

    const settings = data[0];

    // Check app_logo
    if (settings.app_logo) {
        if (settings.app_logo.startsWith('data:image')) {
            console.log('⚠️ app_logo is Base64! Length:', settings.app_logo.length);
        } else {
            console.log('✅ app_logo is URL:', settings.app_logo.substring(0, 80));
        }
    } else {
        console.log('ℹ️ app_logo is not set');
    }

    // Check hero_bg
    const heroBg = settings.landing_page?.hero_bg;
    if (heroBg) {
        if (heroBg.startsWith('data:image')) {
            console.log('⚠️ hero_bg is STILL Base64! Length:', heroBg.length);
        } else {
            console.log('✅ hero_bg is URL:', heroBg.substring(0, 80));
        }
    }

    // Check popup_image
    const popupImg = settings.landing_page?.popup_image;
    if (popupImg) {
        if (popupImg.startsWith('data:image')) {
            console.log('⚠️ popup_image is Base64! Length:', popupImg.length);
        } else {
            console.log('✅ popup_image is URL:', popupImg.substring(0, 80));
        }
    } else {
        console.log('ℹ️ popup_image is not set');
    }

    // Check program images
    const programs = settings.landing_page?.programs || [];
    programs.forEach((p, i) => {
        if (p.image && p.image.startsWith('data:image')) {
            console.log(`⚠️ programs[${i}].image is Base64! Length:`, p.image.length);
        } else if (p.image) {
            console.log(`✅ programs[${i}].image is URL`);
        }
    });

    // Check for ALL other fields with large Base64 content
    const checkObj = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
            const fullPath = path ? `${path}.${key}` : key;
            if (typeof val === 'string' && val.startsWith('data:image') && val.length > 1000) {
                console.log(`⚠️ ${fullPath} is Base64! Length:`, val.length);
            } else if (typeof val === 'object' && val !== null) {
                checkObj(val, fullPath);
            }
        }
    };

    console.log('\n=== Deep scan for ALL Base64 fields ===');
    checkObj(settings);

    // Total size of the response
    const totalSize = JSON.stringify(settings).length;
    console.log(`\n📏 Total settings JSON size: ${(totalSize / 1024).toFixed(1)} KB`);
}

checkAllBase64();
