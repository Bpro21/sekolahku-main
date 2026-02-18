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
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) {
            console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from Secrets!")
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceRoleKey ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        const notification = await req.json()
        console.log("Midtrans Webhook Payload:", JSON.stringify(notification, null, 2))

        const {
            order_id,
            transaction_status,
            payment_type,
            transaction_id,
            fraud_status
        } = notification

        console.log(`Processing Order ID: ${order_id}, Status: ${transaction_status}`)

        // 2. Map Midtrans status to our internal status
        let newStatus = 'unpaid'

        // Midtrans Logic:
        // capture = CC success (if fraud_status is accept)
        // settlement = VA/Gopay/Other success
        if (transaction_status === 'capture') {
            if (fraud_status === 'accept') newStatus = 'paid'
        } else if (transaction_status === 'settlement') {
            newStatus = 'paid'
        } else if (['pending'].includes(transaction_status)) {
            newStatus = 'pending'
        } else if (['deny', 'expire', 'cancel'].includes(transaction_status)) {
            newStatus = 'unpaid'
        }

        console.log(`Mapped status to: ${newStatus}`)

        if (newStatus === 'paid') {
            // Get Invoice details first
            console.log(`Looking for invoice with midtrans_order_id: ${order_id}`)
            let { data: inv, error: invError } = await supabase
                .from('invoices')
                .select('*')
                .eq('midtrans_order_id', order_id)
                .maybeSingle()

            // FALLBACK: If midtrans_order_id search fails, try parsing the ID
            if (!inv) {
                console.log("Invoice not found by tracking ID. Trying ID parse fallback...")
                const parts = order_id.split('-')
                const invIdFromParse = parts.slice(0, -1).join('-') // UUID part

                const { data: invFallback } = await supabase
                    .from('invoices')
                    .select('*')
                    .ilike('id', `%${invIdFromParse}%`)
                    .maybeSingle()

                inv = invFallback
            }

            if (!inv) {
                console.error("CRITICAL: Invoice NOT FOUND in database after all lookup attempts.")
                return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: corsHeaders })
            }

            if (inv && inv.status !== 'paid') {
                console.log(`Updating Invoice ${inv.id} to paid...`)
                // Update Invoice
                const { error: updateError } = await supabase.from('invoices').update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: `Midtrans (${payment_type})`,
                    transaction_id: transaction_id
                }).eq('id', inv.id)

                if (updateError) {
                    console.error("Invoice Update Failed:", updateError.message)
                    throw updateError
                }

                // Update Registration Status
                const { data: regData, error: regError } = await supabase
                    .from('registrations')
                    .select('status, id')
                    .eq('id', inv.registration_id)
                    .single()

                if (regData) {
                    let newRegStatus = 'verified'
                    if (regData.status === 'lulus' || inv.description.toLowerCase().includes('daftar ulang')) {
                        newRegStatus = 'paid'
                    }
                    console.log(`Updating Registration ${regData.id} status to ${newRegStatus}...`)
                    await supabase.from('registrations').update({ status: newRegStatus }).eq('id', regData.id)
                }

                console.log(`SUCCESS: Payment fully processed for Invoice ${inv.id}`)
            } else {
                console.log(`Invoice ${inv?.id} is already marked as paid. Skipping.`)
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
