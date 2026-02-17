// Supabase Edge Function for Midtrans Token Generation
// File: supabase/functions/midtrans-token/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

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

        // 2. Get Midtrans Config from database (SAFE because it's on server)
        const { data: config, error: configError } = await supabase
            .from('payment_config')
            .select('midtrans_server_key, midtrans_mode')
            .eq('id', 'main')
            .single()

        if (configError || !config?.midtrans_server_key) {
            return new Response(JSON.stringify({ error: 'Midtrans config not found or incomplete' }), { status: 500, headers: corsHeaders })
        }

        const { order_id, gross_amount, item_details, customer_details } = await req.json()

        // 3. Call Midtrans Snap API
        const isProd = config.midtrans_mode === 'production'
        const snapUrl = isProd
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

        const authHeader = btoa(`${config.midtrans_server_key}:`)

        const response = await fetch(snapUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authHeader}`
            },
            body: JSON.stringify({
                transaction_details: {
                    order_id: `${order_id}-${Date.now()}`, // Append timestamp to avoid duplicate order ID error during testing
                    gross_amount: gross_amount
                },
                item_details,
                customer_details
            })
        })

        const midtransData = await response.json()

        if (!response.ok) {
            return new Response(JSON.stringify({ message: midtransData.error_messages?.join(', ') || 'Midtrans API Error' }), { status: response.status, headers: corsHeaders })
        }

        return new Response(JSON.stringify(midtransData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
