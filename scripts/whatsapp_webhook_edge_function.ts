// Supabase Edge Function: whatsapp-webhook
// Deploy this to Supabase to handle incoming messages from Fonnte

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from WhatsApp Webhook!")

serve(async (req) => {
    try {
        // 1. Parse Fonnte Data
        const body = await req.json()
        const { device, sender, message, name, url, filename } = body

        if (!sender || !message) {
            return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
        }

        // Initialize Supabase Client (Admin Context)
        // Note: Pastikan environment variable SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah diset di Supabase
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Format Phone Number (Fonnte sender format usually '628xxx')
        const phone = sender;

        console.log(`Receiving message from ${phone}: ${message}`)

        // 3. Find or Create Lead
        let leadId = null;
        let leadName = name || phone;

        // Check existing lead
        const { data: existingLead } = await supabaseAdmin
            .from('leads')
            .select('id, name')
            .eq('phone', phone)
            .single();

        if (existingLead) {
            leadId = existingLead.id;
            // Optional: Update name if previously phone number
            if (name && existingLead.name === phone) {
                await supabaseAdmin.from('leads').update({ name: name }).eq('id', leadId);
            }
        } else {
            // Create new Lead
            const { data: newLead, error: leadError } = await supabaseAdmin
                .from('leads')
                .insert({
                    name: name || phone,
                    phone: phone,
                    source: 'WhatsApp',
                    status: 'inquiry',
                    notes: 'Auto-created from incoming WhatsApp'
                })
                .select()
                .single();

            if (leadError) {
                console.error('Error creating lead:', leadError);
                return new Response(JSON.stringify({ error: leadError.message }), { status: 500 })
            }
            leadId = newLead.id;
        }

        // 4. Find or Create Conversation
        const { data: conversation } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .eq('lead_id', leadId)
            .single();

        let currentMessages = [];
        let conversationId = null;

        if (conversation) {
            currentMessages = conversation.messages || [];
            conversationId = conversation.id;
        } else {
            // Create new Conversation
            const { data: newConv, error: convError } = await supabaseAdmin
                .from('conversations')
                .insert({
                    lead_id: leadId,
                    status: 'open',
                    messages: []
                })
                .select()
                .single();

            if (convError) {
                console.error('Error creating conversation:', convError);
                return new Response(JSON.stringify({ error: convError.message }), { status: 500 })
            }
            conversationId = newConv.id;
        }

        // 5. Append New Message
        const newMessage = {
            id: Date.now(),
            text: message,
            sender: 'user', // Incoming message is from 'user'
            timestamp: new Date().toISOString(),
            status: 'received',
            url: url || null, // If media
            filename: filename || null
        };

        const updatedMessages = [...currentMessages, newMessage];

        // Update Conversation
        const { error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({
                messages: updatedMessages,
                last_message_preview: message,
                last_message_at: new Date(),
                unread_count: (conversation?.unread_count || 0) + 1
            })
            .eq('id', conversationId);

        if (updateError) {
            console.error('Error updating conversation:', updateError);
            return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
        }

        // 6. (Optional) Trigger AI Auto-Reply here?
        // Complex to do in standard Edge Function without setup. 
        // Usually Front-end or background worker handles this.

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

    } catch (err) {
        console.error(err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
