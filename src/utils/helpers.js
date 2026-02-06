import { supabase } from '../config/supabase';

// --- HELPER: GEMINI AI ---
export const callGeminiAI = async (apiKey, prompt, model = 'gemini-2.5-flash') => {
    if (!apiKey) throw new Error("API Key Gemini belum diatur di Pengaturan Ujian.");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon AI.";
    } catch (error) {
        console.error("AI Error:", error);
        throw error;
    }
};

// --- HELPER: WHATSAPP (FONNTE) ---
export const sendWhatsappMessage = async (target, message) => {
    try {
        // 1. Get Token from Supabase
        const { data: settings, error } = await supabase
            .from('app_settings')
            .select('fonnte_token')
            .eq('id', 'main')
            .single();

        if (error || !settings?.fonnte_token) {
            console.error("Token error:", error);
            throw new Error("Token Fonnte belum diatur oleh admin.");
        }
        const token = settings.fonnte_token;

        // 2. Format Phone Number
        if (!target) throw new Error("Nomor tujuan tidak valid");
        let phone = target.replace(/\D/g, ''); // Clean non-digits
        if (phone.startsWith('62')) {
            // Good
        } else if (phone.startsWith('0')) {
            phone = '62' + phone.substring(1);
        }

        // 3. Send Request
        const formData = new FormData();
        formData.append('target', phone);
        formData.append('message', message);
        formData.append('countryCode', '62');

        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': token
            },
            body: formData
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(result.reason || "Gagal mengirim WhatsApp via Fonnte");
        }
        return true;
    } catch (error) {
        console.error("WhatsApp Error:", error);
        throw error;
    }
};

export const sendWhatsappOTP = async (target, otp) => {
    return sendWhatsappMessage(target, `*KODE OTP RAHASIA*\n\nKode OTP Anda adalah: *${otp}*\n\nJangan berikan kode ini kepada siapa pun.`);
};

// --- HELPER: NOTIFICATIONS ---
export const createNotification = async (targetUserId, title, message, type = 'info') => {
    try {
        // Supabase 'notifications' table schema: id, user_id (text/uuid), title, message, type, read (bool), created_at
        await supabase.from('notifications').insert({
            user_id: targetUserId, // 'admin' or uuid
            title,
            message,
            type,
            read: false,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error("Failed to create notification", error);
    }
};

// --- HELPER: FILE TO BASE64 (WITH AUTO COMPRESS FOR IMAGES) ---
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        // 1. Initial size check (Allow up to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            reject(new Error("Ukuran file terlalu besar! Maksimal 10MB."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            // IF NOT IMAGE (e.g. PDF), RETURN DIRECTLY
            if (!file.type.startsWith('image/')) {
                if (file.size > 500 * 1024) {
                    reject(new Error("File PDF max 500KB agar muat di database (Total dokumen max 1MB). Silakan kompres PDF atau convert ke Gambar."));
                    return;
                }
                resolve(event.target.result);
                return;
            }

            // IF IMAGE, COMPRESS
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // 2. Setup Canvas for resizing/compression
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions to keep size reasonable (Standard HD)
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 3. Compress (Aggressive for Supabase JSONB storage limit)
                // Target: ~200KB per image to allow multiple images in one doc
                let quality = 0.7;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                const MAX_CHAR_LENGTH = 250 * 1024; // ~180KB binary size

                while (dataUrl.length > MAX_CHAR_LENGTH && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("File bukan gambar yang valid."));
        };
        reader.onerror = error => reject(error);
    });
};

// --- HELPER: REGION API ---
export const fetchRegionData = async (type, parentId = '') => {
    let url = '';
    const baseUrl = 'https://www.emsifa.com/api-wilayah-indonesia/api';
    if (type === 'provinces') url = `${baseUrl}/provinces.json`;
    else if (type === 'regencies') url = `${baseUrl}/regencies/${parentId}.json`;
    else if (type === 'districts') url = `${baseUrl}/districts/${parentId}.json`;
    else if (type === 'villages') url = `${baseUrl}/villages/${parentId}.json`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        return Array.isArray(data) ? data.map(item => ({ id: item.id, text: item.name })) : [];
    } catch (error) {
        console.error(`Gagal mengambil data ${type}:`, error);
        return [];
    }
};

// --- 2. DATA SEEDING (Transformed for Supabase) ---
export const seedMasterData = async () => {
    try {
        // Minimal seeding logic to verify tables exist
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Ensure Payment Config
        const { data: payConfig } = await supabase.from('payment_config').select('*').eq('id', 'main').single();
        if (!payConfig) {
            await supabase.from('payment_config').insert({
                id: 'main',
                gateway_active: 'manual',
                manual_banks: [{ bank_name: 'BSI', account_number: '777888999', holder_name: 'Yayasan Sekolah' }]
            });
        }

    } catch (error) { console.log("Seeding skipped or failed", error); }
};
