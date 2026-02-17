import { supabase } from '../config/supabase';

// This service interacts with the Supabase Edge Function to get a Snap Token
// The Edge Function then talks to Midtrans API securely using the Server Key.

const EDGE_FUNCTION_URL = 'https://uxqpcizthigbddcbjndi.supabase.co/functions/v1/midtrans-token';

export const MidtransService = {
    async getSnapToken(invoice) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Silakan login kembali.");

            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    order_id: invoice.id,
                    gross_amount: invoice.amount,
                    item_details: [{
                        id: invoice.id,
                        price: invoice.amount,
                        quantity: 1,
                        name: invoice.description
                    }],
                    customer_details: {
                        first_name: invoice.student_name,
                        email: session.user.email
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Gagal mendapatkan token pembayaran.");
            }

            const data = await response.json();
            return data.token; // The Snap Token
        } catch (error) {
            console.error("Midtrans Service Error:", error);
            throw error;
        }
    }
};
