-- Insert Dummy Leads & Conversations untuk Demo

-- 1. Insert Leads
INSERT INTO public.leads (name, phone, source, status, notes)
VALUES 
('Budi Santoso', '6281234567890', 'Instagram', 'inquiry', 'Tanya biaya masuk SD'),
('Siti Aminah', '6289876543210', 'Website', 'registration', 'Anak mau masuk TK'),
('Rudi Hermawan', '6285678901234', 'Referral', 'interview', 'Jadwal interview besok')
ON CONFLICT (phone) DO NOTHING;

-- 2. Insert Conversations (Link ke Leads via Phone)
INSERT INTO public.conversations (lead_id, name, phone, status, unread_count, last_message_preview, last_message_at, messages)
SELECT 
    id, 
    name, 
    phone, 
    'open', 
    1, 
    'Assalamualaikum, mau tanya biaya pendaftaran berapa ya?', 
    NOW(), 
    '[
        {"id": 1, "text": "Assalamualaikum, mau tanya biaya pendaftaran berapa ya?", "sender": "user", "timestamp": "2024-02-05T08:00:00Z", "status": "received"},
        {"id": 2, "text": "Waalaikumsalam. Untuk jenjang apa Bapak/Ibu?", "sender": "agent", "timestamp": "2024-02-05T08:05:00Z", "status": "read"}
    ]'::jsonb
FROM public.leads
WHERE phone IN ('6281234567890', '6289876543210', '6285678901234')
ON CONFLICT (phone) DO NOTHING;
