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
        const { midtrans_order_id } = await req.json()
        if (!midtrans_order_id) throw new Error("Missing midtrans_order_id")

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get Midtrans Config
        const { data: config, error: configError } = await supabase
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
            const { data: inv } = await supabase
                .from('invoices')
                .select('*')
                .eq('midtrans_order_id', midtrans_order_id)
                .single()

            if (inv && inv.status !== 'paid') {
                console.log(`Updating Invoice ${inv.id} to paid via manual verify...`)
                await supabase.from('invoices').update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: `Midtrans (${payment_type})`,
                    transaction_id: transaction_id
                }).eq('id', inv.id)

                // Update Registration
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
