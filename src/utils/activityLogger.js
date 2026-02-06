import { supabase } from '../config/supabase';

export const logActivity = async (user, action, description, metadata = {}) => {
    try {
        if (!user) return;

        // Fetch IP Address
        let ipAddress = 'Unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ipAddress = data.ip;
        } catch (e) {
            console.warn("Failed to fetch IP:", e);
        }

        await supabase.from('system_logs').insert({
            user_email: user.email,
            user_name: user?.user_metadata?.displayName || user.email || 'Unknown',
            user_uid: user.id,
            action: action,
            description: description,
            metadata: metadata,
            ip_address: ipAddress,
            user_agent: navigator.userAgent
        });
    } catch (error) {
        console.error("Failed to write activity log:", error);
    }
};
