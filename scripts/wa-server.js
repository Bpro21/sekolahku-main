import dotenv from 'dotenv';
dotenv.config();
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-terminal';
import express from 'express';
import cors from 'cors';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

let sock;
let appSettings = {};

// ==================== EXPRESS HTTP SERVER ====================
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: !!sock?.user,
        provider: appSettings?.wa_provider || 'unknown'
    });
});

// QR Code endpoint
app.get('/qr', (req, res) => {
    res.json({
        qr: global.currentQR || null,
        connected: !!sock?.user
    });
});

// Send message endpoint (for OTP, etc)
app.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message are required' });
        }

        if (!sock || !sock.user) {
            return res.status(503).json({ error: 'WhatsApp not connected. Please scan QR code first.' });
        }

        // Format phone number
        let targetPhone = phone.replace(/\D/g, '');
        if (targetPhone.startsWith('0')) {
            targetPhone = '62' + targetPhone.substring(1);
        }
        const targetJid = targetPhone + '@s.whatsapp.net';

        console.log(`📤 Sending OTP to ${targetJid}: "${message.substring(0, 30)}..."`);

        await sock.sendMessage(targetJid, { text: message });

        console.log('✅ OTP Sent!');
        res.json({ success: true, message: 'Message sent successfully' });

    } catch (error) {
        console.error('❌ Send Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start HTTP server
const PORT = process.env.BAILEYS_PORT || 3001;
app.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on http://localhost:${PORT}`);
    console.log(`   POST /send - Send WhatsApp message`);
    console.log(`   GET  /health - Check connection status`);
});


// Helper to ensure JID is correctly formatted
function ensureJid(jid) {
    if (!jid) return null;
    if (jid.includes('@')) return jid;
    // Default to standard WhatsApp domain if no domain specified
    return jid + "@s.whatsapp.net";
}

async function fetchAppSettings() {
    try {
        const { data } = await supabase.from('app_settings').select('*').single();
        appSettings = data || {};
        console.log("⚙️  Current Provider: " + (appSettings.wa_provider || 'not set'));
    } catch (e) {
        console.error("❌ Error fetching settings:", e.message);
    }
}

async function startBaileys() {
    const { state, saveCreds } = await useMultiFileAuthState('wa_auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr: newQr } = update;

        if (newQr) {
            console.log("📲 Scan QR Code below to login:");
            qrcode.generate(newQr, { small: true });
            global.currentQR = newQr; // Store QR for frontend
        } else if (connection === 'open') {
            global.currentQR = null; // Clear QR on connection
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Connection closed, reconnecting: ' + shouldReconnect);
            if (shouldReconnect) startBaileys();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected as: ' + sock.user.id);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            await processIncomingMessage(msg);
        }
    });
}

async function processIncomingMessage(msg) {
    try {
        const fullJid = msg.key.remoteJid;
        // Keep the original JID for internal lookups and saving
        const senderId = fullJid.split('@')[0];

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.buttonsResponseMessage?.selectedButtonId || '';
        const messageTimestamp = (msg.messageTimestamp.low || msg.messageTimestamp) * 1000;

        if (Date.now() - messageTimestamp > 5 * 60 * 1000) return; // Skip old

        console.log(`📩 Incoming from ${fullJid}: ${text}`);

        // Try lookup by phone or full JID
        let { data: lead } = await supabase.from('leads').select('*').eq('phone', fullJid).single();
        if (!lead) {
            // Fallback: lookup by ID only (for backwards compatibility)
            let { data: leadById } = await supabase.from('leads').select('*').eq('phone', senderId).single();
            lead = leadById;
        }

        if (!lead) {
            const { data: newLead, error } = await supabase.from('leads').insert({
                name: senderId, phone: fullJid, source: 'whatsapp', status: 'inquiry'
            }).select().single();
            if (error && error.code === '23505') {
                let { data: retry } = await supabase.from('leads').select('*').eq('phone', fullJid).single();
                lead = retry;
            } else lead = newLead;
        }

        if (!lead) return;

        let { data: conv } = await supabase.from('conversations').select('*').eq('lead_id', lead.id).single();
        if (!conv) {
            const { data: newConv } = await supabase.from('conversations').insert({
                lead_id: lead.id, phone: fullJid, status: 'active', messages: []
            }).select().single();
            conv = newConv;
        }

        if (!conv) return;

        const updatedMessages = [...(conv.messages || []), {
            id: Date.now(), text, sender: 'user', timestamp: new Date().toISOString(), status: 'received'
        }];

        await supabase.from('conversations').update({
            messages: updatedMessages,
            last_message_preview: text,
            last_message_at: new Date(),
            unread_count: (conv.unread_count || 0) + 1,
            phone: fullJid
        }).eq('id', conv.id);

        // ==================== AI TEMPLATE AUTO-REPLY ====================
        await processAiAutoReply(text, conv.id, fullJid);

    } catch (err) { console.error("❌ Error processing message:", err.message); }
}

// ==================== SMART DATABASE QUERY FUNCTIONS ====================

// Get quota info from database
async function getQuotaInfo() {
    try {
        const { data: units } = await supabase.from('units').select('*');
        const { data: regs } = await supabase.from('registrations').select('unit_id, status');

        if (!units) return null;

        return units.map(u => {
            const filled = regs?.filter(r =>
                r.unit_id === u.id &&
                ['lulus', 'paid', 'accepted', 're_registration', 'student'].includes((r.status || '').toLowerCase())
            ).length || 0;
            return {
                name: u.name,
                quota: u.quota || 0,
                filled: filled,
                remaining: (u.quota || 0) - filled
            };
        });
    } catch (e) {
        console.error("Error fetching quota:", e.message);
        return null;
    }
}

// Get registration period info
async function getRegistrationPeriod() {
    try {
        const { data } = await supabase.from('academic_years')
            .select('*')
            .eq('is_active', true)
            .single();
        return data;
    } catch (e) {
        console.error("Error fetching period:", e.message);
        return null;
    }
}

// Check student status by phone
async function checkStudentStatus(phone) {
    try {
        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) return null;

        const { data } = await supabase.from('registrations')
            .select('student_name, status, major_name, unit_name, created_at')
            .or(`phone.ilike.%${cleanPhone}%,father_phone.ilike.%${cleanPhone}%,mother_phone.ilike.%${cleanPhone}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        return data;
    } catch (e) {
        console.error("Error checking status:", e.message);
        return null;
    }
}

// Get programs/jurusan list
async function getProgramsList() {
    try {
        const { data } = await supabase.from('units').select('name, description');
        return data;
    } catch (e) {
        return null;
    }
}

// Smart Database-Driven Auto-Reply
async function processAiAutoReply(incomingText, conversationId, targetJid) {
    try {
        const lowerText = incomingText.toLowerCase();
        let replyText = null;

        // Extract phone from JID for status check
        const senderPhone = targetJid.split('@')[0].replace(/\D/g, '');

        // ==================== SMART KEYWORD DETECTION ====================

        // 1. QUOTA CHECK
        if (lowerText.includes('kuota') || lowerText.includes('sisa') || lowerText.includes('kursi')) {
            const quota = await getQuotaInfo();
            if (quota && quota.length > 0) {
                const quotaLines = quota.map(q => `• ${q.name}: ${q.remaining}/${q.quota} kursi tersisa`).join('\n');
                replyText = `📊 *Sisa Kuota Pendaftaran:*\n\n${quotaLines}\n\n_Update: ${new Date().toLocaleDateString('id-ID')}_`;
            }
        }

        // 2. REGISTRATION PERIOD
        else if (lowerText.includes('pendaftaran') || lowerText.includes('buka') || lowerText.includes('tutup') || lowerText.includes('kapan')) {
            const period = await getRegistrationPeriod();
            if (period) {
                const startDate = period.start_date ? new Date(period.start_date).toLocaleDateString('id-ID') : 'Belum ditentukan';
                const endDate = period.end_date ? new Date(period.end_date).toLocaleDateString('id-ID') : 'Belum ditentukan';
                replyText = `📅 *Info Pendaftaran ${period.year || ''}*\n\n📆 Pembukaan: ${startDate}\n🔒 Penutupan: ${endDate}\n📌 Status: ${period.is_active ? 'DIBUKA' : 'DITUTUP'}\n\nSilakan daftar melalui website kami!`;
            }
        }

        // 3. STUDENT STATUS CHECK
        else if (lowerText.includes('status') || lowerText.includes('cek') || lowerText.includes('hasil')) {
            // Try to find phone number in message or use sender's phone
            const phoneMatch = incomingText.match(/\d{10,13}/);
            const phoneToCheck = phoneMatch ? phoneMatch[0] : senderPhone;

            const status = await checkStudentStatus(phoneToCheck);
            if (status) {
                const statusMap = {
                    'draft': '📝 Draft (Belum Lengkap)',
                    'pending': '⏳ Menunggu Verifikasi',
                    'verified': '✅ Terverifikasi',
                    'paid': '💰 Sudah Bayar',
                    'lulus': '🎉 LULUS!',
                    'accepted': '✅ Diterima',
                    'rejected': '❌ Tidak Lolos',
                    'waiting_test': '📝 Menunggu Test',
                    're_registration': '📋 Daftar Ulang',
                    'student': '🎓 Siswa Aktif'
                };
                const statusLabel = statusMap[(status.status || '').toLowerCase()] || status.status;
                replyText = `📋 *Status Pendaftaran*\n\n👤 Nama: ${status.student_name}\n🏫 Jenjang: ${status.unit_name || status.major_name || '-'}\n📌 Status: ${statusLabel}\n\nHubungi admin untuk info lebih lanjut.`;
            } else {
                replyText = `❓ *Status Tidak Ditemukan*\n\nNomor HP tidak terdaftar dalam sistem.\n\nPastikan menggunakan nomor yang sama saat pendaftaran, atau hubungi admin untuk bantuan.`;
            }
        }

        // 4. PROGRAMS/JURUSAN
        else if (lowerText.includes('jurusan') || lowerText.includes('program') || lowerText.includes('jenjang')) {
            const programs = await getProgramsList();
            if (programs && programs.length > 0) {
                const progLines = programs.map(p => `• ${p.name}${p.description ? ': ' + p.description : ''}`).join('\n');
                replyText = `🎓 *Program Pendidikan Tersedia:*\n\n${progLines}\n\nHubungi kami untuk info detail!`;
            }
        }

        // 5. BIAYA
        else if (lowerText.includes('biaya') || lowerText.includes('spp') || lowerText.includes('bayar') || lowerText.includes('harga')) {
            // Try to get from database or use static template
            replyText = `💰 *Informasi Biaya*\n\nUntuk informasi biaya pendaftaran dan SPP, silakan:\n1️⃣ Kunjungi website kami\n2️⃣ Hubungi admin langsung\n3️⃣ Datang ke sekolah\n\nKami akan dengan senang hati menjelaskan rincian biaya.`;
        }

        // 6. FALLBACK TO TEMPLATE (if no smart match)
        if (!replyText) {
            const { data: templates } = await supabase.from('ai_templates').select('*').eq('is_active', true);
            if (templates && templates.length > 0) {
                const matchedTemplate = templates.find(t =>
                    t.trigger_keywords && t.trigger_keywords.some(k => lowerText.includes(k.trim().toLowerCase()))
                );
                if (matchedTemplate) {
                    replyText = matchedTemplate.response_template;
                    // Clean up old button format
                    if (replyText && replyText.includes('|||BUTTONS:')) {
                        replyText = replyText.split('|||BUTTONS:')[0];
                    }
                }
            }
        }

        if (!replyText) return; // No match found

        console.log(`🤖 Smart Reply: "${replyText.substring(0, 50)}..." to ${targetJid}`);

        // Save reply as pending message
        const { data: currentConv } = await supabase.from('conversations').select('messages').eq('id', conversationId).single();
        const msgs = [...(currentConv?.messages || []), {
            id: Date.now(),
            text: replyText,
            sender: 'agent',
            timestamp: new Date().toISOString(),
            status: 'pending',
            is_ai: true
        }];

        await supabase.from('conversations').update({
            messages: msgs,
            last_message_preview: replyText.substring(0, 50),
            last_message_at: new Date()
        }).eq('id', conversationId);

    } catch (err) {
        console.error("❌ Smart Auto-Reply Error:", err.message);
    }
}


async function startPolling() {
    console.log("🔄 Polling started...");
    setInterval(async () => {
        if (!sock || !sock.user) return;
        try {
            const { data: convs } = await supabase.from('conversations')
                .select('*').not('messages', 'is', null);

            for (const conv of convs || []) {
                const msgs = conv.messages || [];
                if (msgs.length === 0) continue;
                const last = msgs[msgs.length - 1];

                if (last.sender === 'agent' && last.status === 'pending') {
                    const target = conv.phone;
                    if (!target) continue;

                    const targetJid = ensureJid(target);
                    console.log(`📤 Sending: "${last.text}" to ${targetJid}`);

                    try {
                        await sock.sendMessage(targetJid, { text: last.text });
                        msgs[msgs.length - 1].status = 'sent';
                        await supabase.from('conversations').update({
                            messages: msgs,
                            last_message_at: new Date() // Force timestamp update for Realtime trigger
                        }).eq('id', conv.id);
                        console.log("✅ Sent!");
                    } catch (e) {
                        console.error("❌ Failed to send:", e.message);
                        msgs[msgs.length - 1].status = 'failed';
                        await supabase.from('conversations').update({ messages: msgs }).eq('id', conv.id);
                    }
                }
            }
        } catch (e) {
            console.error("❌ Polling error:", e.message);
        }
    }, 3000);
}

async function main() {
    await fetchAppSettings();
    if (appSettings?.wa_provider === 'baileys') {
        await startBaileys();
        startPolling();
    } else {
        console.log("😴 Provider is " + appSettings?.wa_provider + ". Standing by...");
        setInterval(async () => {
            await fetchAppSettings();
            if (appSettings?.wa_provider === 'baileys' && !sock) {
                await startBaileys();
                startPolling();
            }
        }, 10000);
    }
}
main();
