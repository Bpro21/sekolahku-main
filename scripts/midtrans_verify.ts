// Supabase Edge Function to Verify Midtrans Payment Status
// File: supabase/functions/midtrans-verify/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // 1. Verify user is logged in
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error('Auth Error:', authError)
            return new Response(JSON.stringify({ error: 'Unauthorized or Invalid JWT', details: authError?.message }), { status: 401, headers: corsHeaders })
        }

        const { midtrans_order_id } = await req.json()
        if (!midtrans_order_id) throw new Error("Missing midtrans_order_id")

        // Use service role client for database updates to ensure they succeed regardless of RLS
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get Midtrans Config
        const { data: config, error: configError } = await supabaseAdmin
            .from('payment_config')
            .select('*')
            .eq('id', 'main')
            .single()

        if (configError || !config) throw new Error("Payment configuration missing.")

        const isProduction = config.midtrans_mode === 'production'
        const statusUrl = `https://api.${isProduction ? '' : 'sandbox.'}midtrans.com/v2/${midtrans_order_id}/status`
        const midtransAuthHeader = btoa(`${config.midtrans_server_key}:`)

        console.log(`Verifying status for: ${midtrans_order_id} at ${statusUrl}`)

        // 2. Call Midtrans API
        const response = await fetch(statusUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${midtransAuthHeader}`
            }
        })

        const statusData = await response.json()
        console.log("Midtrans Status Response:", statusData)

        if (statusData.status_code === "404") {
            return new Response(JSON.stringify({ status: 'not_found', message: 'Transaksi belum dibuat di Midtrans.' }), { status: 200, headers: corsHeaders })
        }

        const transaction_status = statusData.transaction_status
        const fraud_status = statusData.fraud_status
        const payment_type = statusData.payment_type
        const transaction_id = statusData.transaction_id
        const va_numbers = statusData.va_numbers
        const permata_va_number = statusData.permata_va_number

        // 3. Map status
        let newStatus = 'unpaid'
        if (transaction_status === 'capture') {
            if (fraud_status === 'accept') newStatus = 'paid'
        } else if (transaction_status === 'settlement') {
            newStatus = 'paid'
        } else if (['pending'].includes(transaction_status)) {
            newStatus = 'pending'
        }

        // 4. Update DB if paid
        if (newStatus === 'paid') {
            console.log(`Looking for invoice with midtrans_order_id: ${midtrans_order_id}`)
            let { data: inv, error: invError } = await supabaseAdmin
                .from('invoices')
                .select('*')
                .eq('midtrans_order_id', midtrans_order_id)
                .maybeSingle()

            // FALLBACK: If midtrans_order_id search fails, try parsing the ID
            if (!inv) {
                console.log("Invoice not found by tracking ID. Trying ID parse fallback...")
                const parts = midtrans_order_id.split('-')
                const invIdFromParse = parts.slice(0, -1).join('-') // UUID part

                const { data: invFallback } = await supabaseAdmin
                    .from('invoices')
                    .select('*')
                    .ilike('id', `%${invIdFromParse}%`)
                    .maybeSingle()

                inv = invFallback
            }

            if (!inv) {
                console.error("CRITICAL: Invoice NOT FOUND in database after all lookup attempts.")
                return new Response(JSON.stringify({
                    status: 'error',
                    error: "Data invoice tidak ditemukan di database. Pastikan SQL sudah dijalankan.",
                    midtrans_status: transaction_status
                }), { status: 404, headers: corsHeaders })
            }

            if (inv.status !== 'paid') {
                // Create a user-friendly payment method name
                let displayPaymentMethod = payment_type
                if (payment_type === 'bank_transfer') {
                    const bank = va_numbers?.[0]?.bank || (permata_va_number ? 'permata' : 'VA')
                    displayPaymentMethod = `Midtrans ${bank.toUpperCase()}`
                } else if (payment_type === 'cstore') {
                    displayPaymentMethod = `Midtrans (${statusData.store?.toUpperCase() || 'Retail'})`
                } else {
                    displayPaymentMethod = `Midtrans ${payment_type.replace(/_/g, ' ').toUpperCase()}`
                }

                console.log(`Updating Invoice ${inv.id} to paid via manual verify with method: ${displayPaymentMethod}...`)
                const { error: updateError } = await supabaseAdmin.from('invoices').update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: displayPaymentMethod,
                    transaction_id: transaction_id,
                    bank_destination: null // Clear manual bank if paid via Midtrans
                }).eq('id', inv.id)

                if (updateError) {
                    console.error("Invoice Update Failed:", updateError.message)
                    throw updateError
                }

                // Update Registration
                const { data: regData } = await supabaseAdmin
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
                    await supabaseAdmin.from('registrations').update({ status: newRegStatus }).eq('id', regData.id)
                }
            } else {
                console.log(`Invoice ${inv.id} is already paid.`)
            }
        }

        return new Response(JSON.stringify({
            status: newStatus,
            midtrans_status: transaction_status,
            details: statusData
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("Verify Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
