-- =====================================================
-- FIX RLS POLICIES FOR USER MANAGEMENT (Corrected)
-- Avoids infinite recursion by using a security definer function
-- =====================================================

-- 1. Create a security definer function for admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply policies to public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
CREATE POLICY "Admins can delete all profiles" ON public.profiles
    FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- 3. Apply policies to public.user_lookup
ALTER TABLE public.user_lookup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage user_lookup" ON public.user_lookup;
CREATE POLICY "Admins can manage user_lookup" ON public.user_lookup
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own lookup" ON public.user_lookup;
CREATE POLICY "Users can view own lookup" ON public.user_lookup
    FOR SELECT USING (uid = auth.uid());
