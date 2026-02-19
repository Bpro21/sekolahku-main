const SUPABASE_URL = 'https://uxqpcizthigbddcbjndi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cXBjaXp0aGlnYmRkY2JqbmRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5MzM0NiwiZXhwIjoyMDg1NzY5MzQ2fQ.Y1OT-VwPsNZf6lMP6dhhfhGM7tEhPWuwb5GpWas5yNI';

// Replacement URLs for the Base64 images
const SCHOOL_LOGO = 'https://img.logoipsum.com/296.svg';
const SCHOOL_BG = 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=70';
const PROGRAM_IMG = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=70';

async function fixAllBase64() {
    console.log('=== Fetching current settings ===');
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=*`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await getRes.json();
    const settings = data[0];

    // 1. Fix app_logo
    let newLogo = settings.app_logo;
    if (newLogo && newLogo.startsWith('data:image')) {
        newLogo = SCHOOL_LOGO;
        console.log('✅ Replacing app_logo (Base64 -> URL)');
    }

    // 2. Fix landing_page fields
    const lp = { ...settings.landing_page };

    // Fix popup_image
    if (lp.popup_image && lp.popup_image.startsWith('data:image')) {
        lp.popup_image = ''; // Remove popup or set to URL
        console.log('✅ Clearing popup_image Base64');
    }

    // Fix programs images
    if (lp.programs && Array.isArray(lp.programs)) {
        lp.programs = lp.programs.map((p, i) => {
            if (p.img && p.img.startsWith('data:image')) {
                console.log(`✅ Replacing programs[${i}].img (Base64 -> URL)`);
                return { ...p, img: PROGRAM_IMG };
            }
            return p;
        });
    }

    // 3. Fix auth_backgrounds
    let authBgs = settings.auth_backgrounds;
    if (Array.isArray(authBgs)) {
        authBgs = authBgs.map((bg, i) => {
            if (typeof bg === 'string' && bg.startsWith('data:image')) {
                console.log(`✅ Replacing auth_backgrounds[${i}] (Base64 -> URL)`);
                return SCHOOL_BG;
            }
            return bg;
        });
    }

    // 4. Update DB
    console.log('\n=== Updating database ===');
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.${settings.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            app_logo: newLogo,
            landing_page: lp,
            auth_backgrounds: authBgs
        })
    });

    if (updateRes.ok) {
        // Verify new size
        const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            }
        });
        const verifyData = await verifyRes.json();
        const newSize = JSON.stringify(verifyData[0]).length;
        console.log(`\n🎉 SUCCESS! New settings size: ${(newSize / 1024).toFixed(1)} KB (was 456.4 KB)`);
    } else {
        console.error('❌ FAILED:', await updateRes.text());
    }
}

fixAllBase64();
