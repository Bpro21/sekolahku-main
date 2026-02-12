import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../config/supabase";

export const generateAIResponse = async (userMessage, context = "") => {
    try {
        console.log("⚙️ Gemini: Fetching settings...");
        // 1. Get API Key from App Settings
        const { data: settings, error } = await supabase.from('app_settings').select('gemini_api_key, gemini_model').single();

        if (error) {
            console.error("❌ DB Error fetching settings:", error);
            return "Maaf, terjadi kesalahan koneksi database.";
        }

        if (!settings?.gemini_api_key) {
            console.error("❌ Gemini API Key missing in app_settings table.");
            return "Maaf, fitur AI belum dikonfigurasi. Admin harap cek pengaturan API Key.";
        }

        const maskedKey = settings.gemini_api_key ? `...${settings.gemini_api_key.slice(-4)}` : 'MISSING';
        console.log(`🔑 Gemini Key found (${maskedKey}). Model:`, settings.gemini_model || "gemini-1.5-flash");

        // 2. Initialize Gemini
        const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
        // Default to flash if not set
        const modelName = settings.gemini_model || "gemini-1.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        // 3. Prepare Prompt
        const systemPrompt = `
        Anda adalah asisten virtual profesional untuk sekolah.
        Tugas Anda adalah menjawab pertanyaan calon siswa/orang tua dengan ramah, informatif, dan persuasif.
        
        Konteks Sekolah:
        ${context}

        Gunakan Bahasa Indonesia yang sopan dan natural.
        Jawablah dengan ringkas (maksimal 3 paragraf pendek) karena ini pesan WhatsApp.
        Jika pertanyaan tidak jelas, minta klarifikasi.
        `;

        const finalPrompt = `${systemPrompt}\n\nUser: ${userMessage}\nAssistant:`;

        console.log("🚀 Sending request to Gemini...");

        // 4. Generate Content
        const result = await model.generateContent(finalPrompt);
        const response = result.response;
        const text = response.text();

        console.log("✅ Gemini Response:", text);
        return text;

    } catch (error) {
        console.error("❌ Gemini AI Error Details:", error);

        // Detailed error message for debugging
        if (error.message?.includes('API key not valid')) {
            return "Error: API Key Gemini tidak valid.";
        }

        return "Maaf, saya sedang mengalami gangguan sistem AI saat ini.";
    }
};
