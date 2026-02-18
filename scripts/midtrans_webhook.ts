// Supabase Edge Function for Midtrans Webhook (Notification)
// File: supabase/functions/midtrans-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role to bypass RLS for status updates
        )

        const notification = await req.json()
        console.log("Midtrans Notification Received:", notification)

        const {
            order_id,
            transaction_status,
            payment_type,
            transaction_id
        } = notification

        // 2. Map Midtrans status to our internal status
        let newStatus = 'unpaid'
        if (['capture', 'settlement'].includes(transaction_status)) {
            newStatus = 'paid'
        } else if (['pending'].includes(transaction_status)) {
            newStatus = 'pending'
        } else if (['deny', 'expire', 'cancel'].includes(transaction_status)) {
            newStatus = 'unpaid' // Allow retry
        }

        if (newStatus === 'paid') {
            // Get Invoice details first using the exact midtrans_order_id
            const { data: inv, error: invError } = await supabase
                .from('invoices')
                .select('*')
                .eq('midtrans_order_id', order_id)
                .single()

            if (inv && inv.status !== 'paid') {
                // Update Invoice
                await supabase.from('invoices').update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: `Midtrans (${payment_type})`,
                    transaction_id: transaction_id
                }).eq('id', inv.id)

                // Update Registration Status
                const { data: regData } = await supabase
                    .from('registrations')
                    .select('status, id')
                    .eq('id', inv.registration_id)
                    .single()

                if (regData) {
                    let newRegStatus = 'verified'
                    if (regData.status === 'lulus' || inv.description.toLowerCase().includes('daftar ulang')) {
                        newRegStatus = 'paid'
                    }
                    await supabase.from('registrations').update({ status: newRegStatus }).eq('id', regData.id)
                }

                console.log(`Successfully processed payment for Invoice ${inv.id}`)
            }
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("Webhook Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
