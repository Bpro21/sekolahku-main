import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../config/supabase';
import { Card, Button, Input } from '../../ui/Elements';
import { Search, Send, User, MessageCircle, MoreVertical, Paperclip, Mic, Phone, Video, Info, Loader2, PlayCircle, Bot, Sparkles, RefreshCw, AlertTriangle, Server, Wifi } from 'lucide-react';
import { generateAIResponse } from '../../../utils/gemini';

export default function CRMInbox({ showToast }) {
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const [messageText, setMessageText] = useState('');
    const syncIntervalRef = useRef(null);

    // Settings State
    const [aiTemplates, setAiTemplates] = useState([]);
    const [appSettings, setAppSettings] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Fetch initial data
    const fetchConversations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select('*, leads(name, phone)')
                .order('last_message_at', { ascending: false });

            if (error) throw error;
            setConversations(data || []);
        } catch (error) {
            console.error(error);
            showToast('Gagal memuat percakapan', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Keep selected chat in sync with conversations array
    useEffect(() => {
        if (selectedChat) {
            const updated = conversations.find(c => c.id === selectedChat.id);
            if (updated && JSON.stringify(updated.messages) !== JSON.stringify(selectedChat.messages)) {
                setSelectedChat(updated);
            }
        }
    }, [conversations]);

    const fetchAiTemplates = async () => {
        const { data: tpls } = await supabase.from('ai_templates').select('*').eq('is_active', true);
        setAiTemplates(tpls || []);
    };

    const channelRef = useRef(null);

    useEffect(() => {
        fetchConversations();
        fetchAiTemplates();

        // Fetch Settings & Start Logic
        const init = async () => {
            const { data: settings } = await supabase.from('app_settings').select('*').single();
            setAppSettings(settings || {});

            // Logic Dual Provider
            if (settings?.wa_provider === 'baileys') {
                console.log("🟢 Mode: Baileys (Realtime)");

                // Start Realtime
                const channel = supabase
                    .channel('crm-inbox-realtime')
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
                        console.log("Realtime Update:", payload);
                        fetchConversations();
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            setSyncError(null);
                        }
                    });
                channelRef.current = channel;

            } else {
                console.log("☁️ Mode: Fonnte (Polling)");
                if (settings?.fonnte_token) {
                    startAutoSync(settings.fonnte_token);
                }
            }
        };
        init();

        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    // --- LOGIC FONNTE (POLLING) ---
    const startAutoSync = (token) => {
        // Run sync immediately
        syncMessages(token);

        // Then every 15 seconds
        syncIntervalRef.current = setInterval(() => {
            syncMessages(token);
        }, 15000);
    };

    const syncMessages = async (token) => {
        if (!token) return;
        setSyncing(true);
        setSyncError(null);

        try {
            const formData = new FormData();
            formData.append('status', 'unread');
            formData.append('limit', '5');

            let response;
            try {
                response = await fetch('https://api.fonnte.com/get-messages', {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: formData
                });
            } catch (netErr) {
                console.warn("Network Error / CORS Blocked", netErr);
                setSyncError("CORS Blocked. Install 'Allow CORS' ext.");
                return;
            }

            if (response.status === 404) {
                setSyncError("API Sync Fonnte tidak tersedia (404).");
                return;
            }

            if (!response.ok) {
                if (response.status === 0 || response.type === 'opaque') {
                    setSyncError("CORS Blocked. Butuh Extension.");
                    return;
                }
                return;
            }

            const result = await response.json();

            if (result.status && result.data && result.data.length > 0) {
                showToast(`Masuk ${result.data.length} pesan baru WA`, 'success');
                for (const msg of result.data) {
                    await processIncomingMessage(msg);
                }
                await fetchConversations();
            }

        } catch (error) {
            console.warn("Auto-Sync Error:", error.message);
        } finally {
            setSyncing(false);
        }
    };

    const processIncomingMessage = async (waMsg) => {
        const senderPhone = waMsg.sender;
        const text = waMsg.message;

        if (!senderPhone || !text) return;

        let leadId = null;
        let chatId = null;
        let currentMessages = [];

        // 1. Cari Lead by Phone
        const { data: lead } = await supabase.from('leads').select('id').eq('phone', senderPhone).single();
        if (lead) {
            leadId = lead.id;
        } else {
            const { data: newLead } = await supabase.from('leads').insert({
                name: waMsg.name || senderPhone,
                phone: senderPhone,
                source: 'WhatsApp Auto',
                status: 'inquiry'
            }).select().single();
            leadId = newLead?.id;
        }

        if (!leadId) return;

        // 2. Cari Conversation
        const { data: conv } = await supabase.from('conversations').select('*').eq('lead_id', leadId).single();
        if (conv) {
            chatId = conv.id;
            currentMessages = conv.messages || [];
        } else {
            const { data: newConv } = await supabase.from('conversations').insert({
                lead_id: leadId,
                status: 'open',
                messages: []
            }).select().single();
            chatId = newConv?.id;
        }

        const isDuplicate = currentMessages.some(m => m.text === text && (Date.now() - new Date(m.timestamp).getTime() < 300000));
        if (isDuplicate) return;

        const newMessage = {
            id: Date.now(),
            text: text,
            sender: waMsg.from_me ? 'agent' : 'user',
            timestamp: new Date().toISOString(),
            status: 'received'
        };

        const updatedMessages = [...currentMessages, newMessage];

        await supabase.from('conversations').update({
            messages: updatedMessages,
            last_message_preview: text,
            last_message_at: new Date(),
            unread_count: (conv?.unread_count || 0) + 1,
            phone: senderPhone // Ensure phone is stored
        }).eq('id', chatId);

        if (!waMsg.from_me) {
            processAiResponse(text, chatId, senderPhone);
        }
    };

    // MANUAL SYNC BUTTON
    const handleManualSync = async () => {
        if (appSettings?.wa_provider === 'baileys') {
            fetchConversations(); // Just reload DB
            return;
        }
        if (!appSettings?.fonnte_token) {
            showToast("Token Fonnte belum disetting.", "error");
            return;
        }
        showToast("Menghubungkan ke Fonnte...", "info");
        await syncMessages(appSettings.fonnte_token);
        await fetchConversations();
    };

    const processAiResponse = async (incomingText, chatId, targetPhone = null) => {
        const lowerText = incomingText.toLowerCase();
        let replyText = null;
        let isAiGenerated = false;

        const matchedTemplate = aiTemplates.find(t =>
            t.trigger_keywords && t.trigger_keywords.some(k => lowerText.includes(k.trim().toLowerCase()))
        );

        if (matchedTemplate) {
            if (matchedTemplate.use_ai) {
                setIsSimulating(true);
                const aiResponse = await generateAIResponse(incomingText, `Nama Sekolah: ${appSettings?.school_name || 'Sekolah Weebs'}`);
                replyText = aiResponse;
                isAiGenerated = true;
            } else {
                replyText = matchedTemplate.response_template;
            }
        }

        if (replyText) {
            const delay = isAiGenerated ? 500 : 3000;
            setTimeout(async () => {
                const aiMessage = {
                    id: Date.now(),
                    text: replyText,
                    sender: 'agent',
                    timestamp: new Date().toISOString(),
                    status: 'pending', // PENDING -> Server will process this logic
                    is_ai: isAiGenerated
                };

                // If Fonnte, we send immediately then save. If Baileys, we save then server sends.
                const isBaileys = appSettings?.wa_provider === 'baileys';

                if (isBaileys) {
                    // BAILEYS FLOW: Insert Pending -> Server picks up -> Updates to Sent
                    const { data: currentChat } = await supabase.from('conversations').select('messages').eq('id', chatId).single();
                    const msgs = [...(currentChat?.messages || []), aiMessage];

                    await supabase.from('conversations').update({
                        messages: msgs,
                        last_message_preview: replyText,
                        last_message_at: new Date(),
                        phone: targetPhone // Essential for Baileys server
                    }).eq('id', chatId);

                } else {
                    // FONNTE FLOW: Send -> Update DB (Sent)
                    const finalPhone = targetPhone;
                    let sendStatus = 'sent';
                    if (appSettings?.fonnte_token && finalPhone) {
                        const sent = await sendToFonnte(finalPhone, replyText);
                        if (!sent) sendStatus = 'failed';
                    }

                    aiMessage.status = sendStatus;

                    const { data: currentChat } = await supabase.from('conversations').select('messages').eq('id', chatId).single();
                    const msgs = [...(currentChat?.messages || []), aiMessage];

                    await supabase.from('conversations').update({
                        messages: msgs,
                        last_message_preview: replyText,
                        last_message_at: new Date()
                    }).eq('id', chatId);

                    if (selectedChat?.id === chatId) {
                        setIsSimulating(false);
                        fetchConversations();
                    }
                }


            }, delay);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() || !selectedChat) return;

        const isBaileys = appSettings?.wa_provider === 'baileys';
        const targetPhone = selectedChat.phone || selectedChat.leads?.phone;

        const newMessage = {
            id: Date.now(),
            text: messageText,
            sender: 'agent',
            timestamp: new Date().toISOString(),
            status: 'pending' // pending = centang 1 (menunggu server)
        };

        // 1. Update DB First (Optimistic)
        await saveMessageToDB(newMessage, selectedChat.id);
        setMessageText('');

        if (isBaileys) {
            // Server script will listen to DB change and send the message
            // We rely on Realtime to update status to 'sent'
        } else {
            // Fonnte Logic
            if (appSettings?.fonnte_token && targetPhone) {
                await sendToFonnte(targetPhone, messageText);
            } else {
                if (!appSettings?.fonnte_token) showToast('Token Fonnte belum disetting.', 'warning');
            }
        }
    };

    const sendToFonnte = async (target, message) => {
        try {
            const formData = new FormData();
            formData.append('target', target);
            formData.append('message', message);
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: { 'Authorization': appSettings.fonnte_token },
                body: formData
            });
            const result = await response.json();
            if (!result.status) {
                showToast(`Gagal kirim WA: ${result.reason}`, 'error');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Fonnte Network Error:', error);
            showToast('Gagal koneksi ke Fonnte (CORS/Network)', 'error');
            return false;
        }
    };

    const saveMessageToDB = async (msg, chatId) => {
        const { data: currentChat } = await supabase.from('conversations').select('messages').eq('id', chatId).single();
        const updatedMessages = [...(currentChat?.messages || []), msg];

        // Optimistic UI Update
        if (selectedChat?.id === chatId) {
            setSelectedChat(prev => ({ ...prev, messages: updatedMessages }));
        }
        // 2. Persist to DB
        // Hanya update kolom yang pasti ada (messages & last_message_preview)
        // Kita buang updated_at dan last_message_at agar tidak error 400 jika kolom tsb belum ada
        await supabase.from('conversations').update({
            messages: updatedMessages,
            last_message_preview: msg.text,
            last_message_at: new Date(),
            phone: selectedChat.phone || selectedChat.leads?.phone
        }).eq('id', chatId);
    };

    const handleSimulateIncoming = async () => {
        if (!messageText.trim() || !selectedChat) return;
        const userMessage = {
            id: Date.now(),
            text: messageText,
            sender: 'user',
            timestamp: new Date().toISOString(),
            status: 'received'
        };
        setMessageText('');
        await saveMessageToDB(userMessage, selectedChat.id);
        processAiResponse(userMessage.text, selectedChat.id);
    };

    // Scroll to bottom functionality
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (selectedChat?.messages) {
            scrollToBottom();
        }
    }, [selectedChat?.messages, selectedChat?.id]);

    return (
        <div className="flex h-[calc(100vh-240px)] bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {/* Search & Status Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                            {appSettings?.wa_provider === 'baileys' ? (
                                <Wifi size={12} className="text-emerald-500" />
                            ) : (
                                syncError ? <AlertTriangle size={12} className="text-amber-500" /> : <RefreshCw size={12} className={syncing ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                            )}

                            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                                {appSettings?.wa_provider === 'baileys' ?
                                    "Baileys Mode (Server)" :
                                    (syncing ? "Fonnte Syncing..." : (syncError || "Fonnte Cloud"))
                                }
                            </span>
                        </div>
                        <Button size="xs" variant="ghost" onClick={handleManualSync} title="Force Refresh" disabled={syncing}>
                            <RefreshCw size={14} />
                        </Button>
                    </div>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Cari chat..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Memuat chat...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            <p>Inbox Kosong.</p>
                            <div className="mt-4 p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                                <p className="font-bold mb-1">Tips:</p>
                                <p>Pastikan script <code>wa-server.js</code> berjalan jika menggunakan Baileys.</p>
                            </div>
                        </div>
                    ) : (
                        conversations
                            .filter(c => (c.leads?.name || c.name || c.phone || '').toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(chat => (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedChat?.id === chat.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold text-sm ${selectedChat?.id === chat.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                            {chat.leads?.name || chat.name || chat.phone}
                                        </h4>
                                        <span className="text-[10px] text-slate-400">
                                            {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                            {chat.last_message_preview || 'Belum ada pesan'}
                                        </p>
                                        {chat.unread_count > 0 && (
                                            <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                                {chat.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                            <div className="flex items-center gap-3">
                                <Button size="sm" variant="ghost" className="md:hidden p-0" onClick={() => setSelectedChat(null)}>
                                    SC
                                </Button>
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                                    {(selectedChat.leads?.name || selectedChat.name || selectedChat.phone || '?').charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{selectedChat.leads?.name || selectedChat.name || selectedChat.phone}</h3>
                                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                                        <Phone size={12} /> {selectedChat.phone || selectedChat.leads?.phone}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" className="text-slate-500"><Phone size={18} /></Button>
                                <Button size="sm" variant="ghost" className="text-slate-500"><Video size={18} /></Button>
                                <Button size="sm" variant="ghost" className="text-slate-500"><Info size={18} /></Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                            {(!selectedChat.messages || selectedChat.messages.length === 0) && (
                                <div className="text-center py-10 text-slate-400 text-sm italic">
                                    Belum ada pesan. Mulai percakapan sekarang.
                                </div>
                            )}

                            {selectedChat.messages?.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${msg.sender === 'agent'
                                        ? 'bg-emerald-600 text-white rounded-tr-none'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            {msg.is_ai && <span className="text-[9px] text-emerald-200 bg-emerald-700/50 px-1 rounded flex items-center gap-0.5"><Bot size={8} /> AI</span>}
                                            <div className="flex items-center gap-1 text-[10px] ml-auto">
                                                <span className={`${msg.sender === 'agent' ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {msg.sender === 'agent' && (
                                                    <span className="opacity-70">
                                                        {msg.status === 'pending' && '✓'}
                                                        {msg.status === 'sent' && '✓✓'}
                                                        {msg.status === 'read' && '✓✓'}
                                                        {msg.status === 'failed' && <AlertTriangle size={12} className="text-red-400" title="Gagal Terkirim" />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-600"><Paperclip size={20} /></Button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Ketik pesan..."
                                        className="w-full pl-4 pr-10 py-3 bg-slate-100 dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button
                                        onClick={handleSimulateIncoming}
                                        title="Simulasi Pesan Masuk (Demo)"
                                        className="absolute right-3 top-2.5 text-slate-300 hover:text-indigo-500 transition-colors"
                                    >
                                        <Bot size={18} />
                                    </button>
                                </div>
                                <Button
                                    onClick={handleSendMessage}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg w-10 h-10 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none"
                                >
                                    <Send size={18} />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : ( // Empty State
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            {appSettings?.wa_provider === 'baileys' ? <Server size={40} className="text-emerald-300" /> : <MessageCircle size={40} className="text-slate-300" />}
                        </div>
                        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">WhatsApp Inbox ({appSettings?.wa_provider === 'baileys' ? 'Baileys' : 'Fonnte'})</h3>
                        <p className="text-sm">Pilih percakapan untuk mulai chat</p>
                    </div>
                )}
            </div>
        </div>
    );
}
