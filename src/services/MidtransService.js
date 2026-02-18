import { supabase } from '../config/supabase';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/midtrans-token`;

export const MidtransService = {
    async getSnapToken(invoice) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: { session } } = await supabase.auth.getSession();
            if (!user || !session) throw new Error("Silakan login kembali.");

            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
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
                throw new Error(errorData.message || errorData.error || "Gagal mendapatkan token pembayaran.");
            }

            const data = await response.json();
            return data.token; // The Snap Token
        } catch (error) {
            console.error("Midtrans Service Error:", error);
            throw error;
        }
    },

    async verifyPayment(midtransOrderId) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Silakan login kembali.");

            const response = await fetch(`${EDGE_FUNCTION_URL.replace('token', 'verify')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ midtrans_order_id: midtransOrderId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Gagal memverifikasi pembayaran.");
            }

            return await response.json();
        } catch (error) {
            console.error("Verify Payment Error:", error);
            throw error;
        }
    }
};
