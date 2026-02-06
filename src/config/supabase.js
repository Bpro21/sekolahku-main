
import { createClient } from '@supabase/supabase-js';

// TODO: Ganti dengan URL dan API Key proyek Supabase Anda
// Anda bisa mendapatkannya di Dashboard Supabase > Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'MASUKKAN_SUPABASE_URL_DISINI';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'MASUKKAN_SUPABASE_ANON_KEY_DISINI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
