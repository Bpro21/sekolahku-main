-- =====================================================
-- SCRIPT: AUTO CREATE PROFILE & LOOKUP ON SIGNUP
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. Create Function to Handle New User Profile
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_name TEXT;
BEGIN
    -- Extract metadata from auth.users (sent from client options.data)
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_name := NEW.raw_user_meta_data->>'displayName';

    -- If phone is not provided in metadata, fallback to email as name if name missing
    IF v_name IS NULL THEN
        v_name := split_part(NEW.email, '@', 1);
    END IF;

    -- 1. Insert into public.profiles
    INSERT INTO public.profiles (id, name, email, phone, role)
    VALUES (NEW.id, v_name, NEW.email, v_phone, 'user')
    ON CONFLICT (id) DO UPDATE 
    SET 
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        updated_at = NOW();

    -- 2. Insert into public.user_lookup (if phone exists)
    IF v_phone IS NOT NULL THEN
        INSERT INTO public.user_lookup (phone, email, uid)
        VALUES (v_phone, NEW.email, NEW.id)
        ON CONFLICT (phone) DO UPDATE 
        SET 
            email = EXCLUDED.email,
            uid = EXCLUDED.uid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. ENSURE RLS POLICIES ALLOW AUTHENTICATED ACCESS
-- Even with triggers, users need to be able to see their own data
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Done!
