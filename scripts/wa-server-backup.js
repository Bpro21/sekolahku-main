import dotenv from 'dotenv';
dotenv.config();
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-terminal';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

let sock;
let appSettings = {};

async function fetchAppSettings() {
    const { data } = await supabase.from('app_settings').select('*').single();
    appSettings = data || {};
    console.log(`⚙️  Current Provider: ${appSettings.wa_provider || 'not set'}`);
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
        defaultQueryTimeoutMs: 0,
        retryRequestDelayMs: 250
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📲 Scan QR Code below to login:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                await startBaileys();
            }
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
        const senderPhone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.buttonsResponseMessage?.selectedButtonId || '';
        const messageTimestamp = (msg.messageTimestamp.low || msg.messageTimestamp) * 1000;
        const now = Date.now();

        // 0. Skip old messages (older than 5 minutes) to prevent duplicates on restart
        if (now - messageTimestamp > 5 * 60 * 1000) {
            console.log(`⏳ Skipping old message from ${senderPhone} (${Math.round((now - messageTimestamp) / 1000 / 60)} mins old)`);
            return;
        }

        console.log(`📩 Incoming from ${senderPhone}: ${text}`);

        // 1. Find or Create Lead
        console.log(`🔍 Looking for lead with phone: ${senderPhone}`);
        let { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', senderPhone)
            .single();

        if (leadError || !lead) {
            console.log(`➕ Creating new lead for ${senderPhone}`);
            const { data: newLead, error: createError } = await supabase.from('leads').insert({
                name: senderPhone,
                phone: senderPhone,
                source: 'whatsapp',
                status: 'inquiry'
            }).select().single();

            if (createError) {
                // If it failed because of competitive creation, try fetching again
                if (createError.code === '23505') { // Unique constraint violation (if any)
                    let { data: retryLead } = await supabase.from('leads').select('*').eq('phone', senderPhone).single();
                    if (retryLead) { lead = retryLead; } else { return; }
                } else {
                    console.error("❌ Error creating lead:", createError);
                    return;
                }
            } else {
                lead = newLead;
                console.log(`✅ Created new lead: ${lead.id}`);
            }
        } else {
            console.log(`✅ Found existing lead: ${lead.id}`);
        }

        // 2. Find or Create Conversation
        let chatId;
        console.log(`🔍 Looking for conversation with lead_id: ${lead.id}`);
        let { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('lead_id', lead.id)
            .single();

        let currentMessages = [];

        if (convError || !conv) {
            console.log(`➕ Creating new conversation for lead ${lead.id}`);
            const { data: newConv, error: createConvError } = await supabase.from('conversations').insert({
                lead_id: lead.id,
                status: 'active',
                messages: []
            }).select().single();

            if (createConvError) {
                console.error("❌ Error creating conversation:", createConvError);
                return;
            }

            chatId = newConv?.id;
            console.log(`✅ Created new conversation: ${chatId}`);
        } else {
            currentMessages = conv.messages || [];
            console.log(`✅ Found existing conversation: ${conv.id} with ${currentMessages.length} messages`);
            chatId = conv.id;
        }

        // 3. Append Message
        const newMessage = {
            id: Date.now(),
            text: text,
            sender: 'user',
            timestamp: new Date().toISOString(),
            status: 'received',
            baileys_id: msg.key.id
        };

        const updatedMessages = [...currentMessages, newMessage];
        console.log(`💾 Updating conversation ${chatId} with new message`);

        const { error: updateError } = await supabase.from('conversations').update({
            messages: updatedMessages,
            last_message_preview: text,
            last_message_at: new Date(),
            unread_count: (conv?.unread_count || 0) + 1
        }).eq('id', chatId);

        if (updateError) {
            console.error("❌ Error updating conversation:", updateError);
            return;
        }

        console.log(`✅ Message saved successfully to conversation ${chatId}`);

    } catch (err) {
        console.error("❌ FATAL Error processing incoming:", err);
    }
}

// Listen for Outgoing Messages (Realtime)
function startOutgoingListener() {
    console.log("👂 Listening for outgoing messages...");

    supabase
        .channel('conversations-baileys')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, async (payload) => {
            console.log("🔔 Realtime UPDATE detected:", JSON.stringify(payload.new, null, 2));
            const newData = payload.new;

            if (!newData.messages || newData.messages.length === 0) {
                console.log("⚠️ No messages in conversation, skipping");
                return;
            }

            const lastMessage = newData.messages[newData.messages.length - 1];
            console.log(`📨 Last message:`, JSON.stringify(lastMessage, null, 2));

            // Check if Needs Sending
            if (lastMessage.sender === 'agent' && lastMessage.status === 'pending') {
                console.log(`📤 Sending message to Conversation ${newData.id}...`);

                // Get Phone Number
                const { data: conv, error: convError } = await supabase.from('conversations').select('leads(phone)').eq('id', newData.id).single();

                if (convError) {
                    console.error("❌ Error fetching conversation:", convError);
                    return;
                }

                const targetPhone = conv?.leads?.phone;
                console.log(`📞 Target phone: ${targetPhone}, Socket ready: ${!!sock}`);

                if (targetPhone && sock) {
                    try {
                        const jid = targetPhone + '@s.whatsapp.net';
                        console.log(`📲 Sending to ${jid}: "${lastMessage.text}"`);

                        // Ensure socket is ready
                        if (!sock || !sock.user) {
                            throw new Error("Socket not logged in or user not found");
                        }

                        await sock.sendMessage(jid, { text: lastMessage.text });

                        // Update Status to Sent
                        const updatedMessages = [...newData.messages];
                        updatedMessages[updatedMessages.length - 1].status = 'sent';

                        await supabase.from('conversations').update({
                            messages: updatedMessages
                        }).eq('id', newData.id);

                        console.log("✅ Message sent successfully!");
                    } catch (e) {
                        console.error("❌ Send failed:", e);
                        // Update Status to Failed
                        const updatedMessages = [...newData.messages];
                        updatedMessages[updatedMessages.length - 1].status = 'failed';

                        await supabase.from('conversations').update({
                            messages: updatedMessages
                        }).eq('id', newData.id);
                    }
                } else {
                    console.warn(`⚠️ Cannot send - Phone: ${targetPhone}, Socket: ${!!sock}`);
                }
            } else {
                console.log(`ℹ️ Message not for sending - sender: ${lastMessage.sender}, status: ${lastMessage.status}`);
            }
        })
        .subscribe((status) => {
            console.log(`🔌 Realtime subscription status: ${status}`);
            if (status === 'SUBSCRIBED') {
                console.log("✅ Successfully subscribed to conversations updates!");
            } else if (status === 'CHANNEL_ERROR') {
                console.error("❌ Realtime subscription error!");
            }
        });
}

// POLLING FALLBACK: Check for pending messages every 2 seconds
async function startPollingFallback() {
    console.log("🔄 Starting polling fallback (every 2 seconds)...");

    setInterval(async () => {
        try {
            const { data: conversations, error } = await supabase
                .from('conversations')
                .select('id, messages, lead_id, leads(phone)')
                .not('messages', 'is', null);

            if (error) return;

            for (const conv of conversations || []) {
                if (!conv.messages || conv.messages.length === 0) continue;

                const lastMessage = conv.messages[conv.messages.length - 1];

                if (lastMessage.sender === 'agent' && lastMessage.status === 'pending') {
                    console.log(`📤 [POLLING] Detected pending message in ${conv.id}`);

                    const targetPhone = conv.leads?.phone;

                    if (targetPhone && sock) {
                        try {
                            const jid = targetPhone + '@s.whatsapp.net';
                            console.log(`📲 [POLLING] Sending: "${lastMessage.text}"`);

                            // Ensure socket is ready
                            if (!sock || !sock.user) {
                                throw new Error("Socket not ready (logged out?)");
                            }

                            await sock.sendMessage(jid, { text: lastMessage.text });

                            const updatedMessages = [...conv.messages];
                            updatedMessages[updatedMessages.length - 1].status = 'sent';

                            await supabase.from('conversations').update({
                                messages: updatedMessages
                            }).eq('id', conv.id);

                            console.log("✅ [POLLING] Message sent!");
                        } catch (e) {
                            console.error("❌ [POLLING] Failed:", e.message);

                            const updatedMessages = [...conv.messages];
                            updatedMessages[updatedMessages.length - 1].status = 'failed';

                            await supabase.from('conversations').update({
                                messages: updatedMessages
                            }).eq('id', conv.id);
                        }
                    }
                }
            }
        } catch (err) {
            // Silent fail for polling
        }
    }, 2000);
}

async function main() {
    await fetchAppSettings();

    // Logic Switch
    if (appSettings?.wa_provider === 'baileys') {
        await startBaileys();
        startOutgoingListener(); // Try Realtime
        startPollingFallback(); // Fallback polling
    } else {
        console.log("😴 WA Provider is set to 'fonnte'. Baileys Gateway is idle.");
        console.log("ℹ️  Change 'wa_provider' to 'baileys' in App Settings to activate.");

        setInterval(async () => {
            await fetchAppSettings();
            if (appSettings?.wa_provider === 'baileys' && !sock) {
                console.log("🔄 Detected Provider Change! Starting Baileys...");
                await startBaileys();
                startOutgoingListener();
                startPollingFallback();
            }
        }, 30000);
    }
}

main();
