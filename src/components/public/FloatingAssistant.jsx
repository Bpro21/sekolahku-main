import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageCircle, RefreshCw } from 'lucide-react';
import { callGeminiAI } from '../../utils/helpers';

export default function FloatingAssistant({ aiSettings, apiKey, realtimeData }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);
    const hasInitialized = useRef(false);

    // Initialize chat with welcome message
    useEffect(() => {
        if (!hasInitialized.current && aiSettings?.welcome_msg) {
            setMessages([{ role: 'assistant', text: aiSettings.welcome_msg }]);
            hasInitialized.current = true;
        }
    }, [aiSettings]);

    // Scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !apiKey) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsTyping(true);

        try {
            // Construct Prompt
            const systemPrompt = `
                ${aiSettings.persona || 'Anda adalah asisten virtual sekolah.'}
                
                Gunakan informasi berikut sebagai BASIS PENGETAHUAN (Knowledge Base) anda untuk menjawab pertanyaan user.
                Jika jawaban tidak ada di data ini, arahkan user untuk menghubungi kontak WhatsApp sekolah.
                JANGAN MENGARANG JAWABAN yang tidak ada faktanya di data ini.
                
                DATA SEKOLAH:
                """
                ${aiSettings.knowledge_base || 'Belum ada data spesifik.'}
                """

                ${realtimeData ? `
                DATA REALTIME DARI DATABASE:
                """
                ${realtimeData}
                """
                ` : ''}
                
                Jawab dengan sopan, ramah, dan membantu.
                Pertanyaan User: "${userMsg}"
            `;

            const reply = await callGeminiAI(apiKey, systemPrompt);
            setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: "Maaf, saat ini saya (AI) sedang mengalami gangguan koneksi. Silakan hubungi via WhatsApp." }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!aiSettings?.active) return null;

    return (
        <>
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-28 md:bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center gap-2 animate-bounce-slow"
                >
                    <MessageCircle size={24} />
                    <span className="font-bold hidden md:inline">Tanya {aiSettings.bot_name || 'AI'}</span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[90vw] md:w-96 h-[500px] max-h-[80vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-slide-up font-sans">
                    {/* Header */}
                    <div className="bg-emerald-600 p-4 flex justify-between items-center text-white shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">{aiSettings.bot_name || 'AI Assistant'}</h4>
                                <span className="text-[10px] bg-emerald-500/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span> Online
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded-full text-white/80 hover:text-white transition">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 relative">
                        {/* Background watermark */}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-tr-none'
                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-tl-none'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-1 shadow-sm">
                                    <RefreshCw size={12} className="animate-spin" /> Mengetik...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ketik pertanyaan Anda..."
                            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 border rounded-full text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            disabled={isTyping}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white p-2.5 rounded-full transition-colors shadow-sm"
                        >
                            <Send size={18} />
                        </button>
                    </form>

                    {/* Footer attribution */}
                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 py-1 bg-slate-50 dark:bg-slate-800">
                        Powered by Gemini AI
                    </div>
                </div>
            )}
        </>
    );
}
