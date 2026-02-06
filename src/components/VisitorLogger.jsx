import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';

const VisitorLogger = () => {
    const location = useLocation();
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockedIp, setBlockedIp] = useState('');

    useEffect(() => {
        const logVisit = async () => {
            // Avoid logging in dev environment if needed
            if (import.meta.env.MODE === 'development' && !window.location.href.includes('localhost')) {
                // strict logic
            }

            try {
                // 1. Get IP (Cache in Session)
                let ip = sessionStorage.getItem('visitor_ip');
                if (!ip) {
                    try {
                        const res = await fetch('https://api.ipify.org?format=json');
                        const data = await res.json();
                        ip = data.ip;
                        sessionStorage.setItem('visitor_ip', ip);
                    } catch (e) {
                        console.warn('Failed to get IP', e);
                        ip = 'Unknown';
                    }
                }

                // 2. Check Block (TODO: Implement Blocked IPs table in Supabase if needed)
                // For now, we skip the blocking check or implement it later.
                /*
                const { data: blocked } = await supabase.from('blocked_ips').select('*').eq('ip', ip).single();
                if (blocked) {
                    setBlockedIp(ip);
                    setIsBlocked(true);
                    return;
                }
                */

                // 3. Log Visit
                await supabase.from('visitor_logs').insert({
                    ip: ip, // Changed from ip_address to match schema 'ip'
                    page: location.pathname,
                    user_agent: navigator.userAgent
                    // referrer: document.referrer || '' 
                });

            } catch (error) {
                console.error("Visitor Log Error:", error);
            }
        };

        logVisit();
    }, [location]);

    if (isBlocked) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#0f172a',
                color: 'white',
                fontFamily: 'sans-serif',
                textAlign: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: '#ef4444' }}>Access Denied</h1>
                    <p>Your IP address ({blockedIp}) has been blocked by the administrator.</p>
                    <p style={{ marginTop: '20px', fontSize: '0.8rem', opacity: 0.5 }}>Security System</p>
                </div>
            </div>
        );
    }

    return null;
};

export default VisitorLogger;
