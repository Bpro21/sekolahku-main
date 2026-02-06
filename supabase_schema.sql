
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Stores user data)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  email text,
  phone text,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for Profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. APP SETTINGS (Stores configuration)
create table if not exists public.app_settings (
  id text primary key, -- e.g., 'main'
  app_name text,
  school_name text,
  app_logo text,
  welcome_message text,
  auth_backgrounds text[], -- Array of URLs
  landing_page jsonb, -- Store complex landing page config as JSON
  fonnte_token text,
  template_otp text,
  admins jsonb, -- List of admin emails/perms
  app_version text,
  app_template text,
  seo jsonb,
  ai_assistant jsonb,
  announcement jsonb,
  created_at timestamptz default now()
);
alter table public.app_settings enable row level security;
create policy "Settings viewable by everyone" on public.app_settings for select using (true);
create policy "Settings updateable by authenticated" on public.app_settings for update using (auth.role() = 'authenticated');

-- Insert default settings
insert into public.app_settings (id, app_name, school_name, welcome_message)
values ('main', 'PSB Online', 'Sekolah Demo', 'Selamat Datang di Portal PPDB')
on conflict (id) do nothing;


-- 3. ACADEMIC YEARS
create table if not exists public.academic_years (
  id text primary key, -- e.g., '2025-2026'
  year text,
  is_active boolean,
  is_default boolean,
  indent_enabled boolean,
  indent_start_date date,
  indent_end_date date,
  created_at timestamptz default now()
);
alter table public.academic_years enable row level security;
create policy "Academic years viewable by everyone" on public.academic_years for select using (true);
create policy "Academic years updateable by authenticated" on public.academic_years for update using (auth.role() = 'authenticated');
create policy "Academic years insertable by authenticated" on public.academic_years for insert with check (auth.role() = 'authenticated');

-- 4. UNITS (Branches/Cabang)
create table if not exists public.units (
  id text primary key, -- e.g., 'unit-1'
  name text,
  level text,
  location text,
  quota integer,
  filled integer default 0,
  cost_reg integer default 0,
  cost_rereg integer default 0,
  majors jsonb, -- Array of majors objects
  academic_configs jsonb,
  open boolean default true,
  created_at timestamptz default now()
);
alter table public.units enable row level security;
create policy "Units viewable by everyone" on public.units for select using (true);
create policy "Units updateable by authenticated" on public.units for update using (auth.role() = 'authenticated');

-- 5. WAVES (Gelombang Pendaftaran)
create table if not exists public.waves (
  id text primary key,
  name text,
  academic_year text,
  start_date text, -- or date
  end_date text, -- or date
  active boolean,
  year text, -- redundant but useful for filtering
  created_at timestamptz default now()
);
alter table public.waves enable row level security;
create policy "Waves viewable by everyone" on public.waves for select using (true);
create policy "Waves manipulation by authenticated" on public.waves for all using (auth.role() = 'authenticated');

-- 6. REGISTRATIONS
create table if not exists public.registrations (
  id text primary key, -- UUID string
  user_id uuid references auth.users,
  parent_name text,
  student_name text,
  student_religion text,
  unit_id text,
  unit_name text,
  unit_level text,
  major text,
  path_id text,
  path_name text,
  wave_id text,
  wave_name text,
  academic_year text,
  category text,
  status text default 'draft', -- submitted, verified, paid, etc.
  payment_status text,
  is_indent boolean,
  is_scholarship boolean,
  uploaded_docs jsonb, -- documents: { kk: base64, ... }
  cost_reg integer,
  cost_rereg integer,
  biodata jsonb, -- All form data
  reregistration_docs jsonb,
  reregistration_deferment jsonb,
  reminder_history jsonb default '{}'::jsonb,
  resignation_data jsonb,
  previous_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.registrations enable row level security;
create policy "Registrations viewable by owner" on public.registrations for select using (auth.uid() = user_id);
create policy "Registrations insertable by owner" on public.registrations for insert with check (auth.uid() = user_id);
create policy "Registrations updatable by owner" on public.registrations for update using (auth.uid() = user_id);
create policy "Registrations viewable by admin" on public.registrations for select using (auth.role() = 'authenticated'); -- adjust for admin role later

-- 7. INVOICES
create table if not exists public.invoices (
  id text primary key,
  user_id uuid references auth.users,
  registration_id text references public.registrations(id),
  student_name text,
  amount integer,
  description text,
  status text default 'pending', -- pending, paid, expired
  payment_method text,
  payment_proof text, -- Base64
  discount_info jsonb,
  created_at timestamptz default now()
);
alter table public.invoices enable row level security;
create policy "Invoices viewable by owner" on public.invoices for select using (auth.uid() = user_id);
create policy "Invoices insertable by owner" on public.invoices for insert with check (auth.uid() = user_id);
create policy "Invoices updatable by owner" on public.invoices for update using (auth.uid() = user_id);
create policy "Invoices viewable by admin" on public.invoices for select using (auth.role() = 'authenticated');

-- 8. VOUCHERS
create table if not exists public.vouchers (
  id text primary key, -- or code
  code text unique,
  description text,
  discount_amount integer,
  quota integer,
  used integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.vouchers enable row level security;
create policy "Vouchers viewable by everyone" on public.vouchers for select using (true);
create policy "Vouchers admin only" on public.vouchers for insert with check (auth.role() = 'authenticated');
create policy "Vouchers admin update" on public.vouchers for update using (auth.role() = 'authenticated');

-- 9. USER LOOKUP (For Phone check)
create table if not exists public.user_lookup (
  phone text primary key,
  email text,
  uid uuid,
  created_at timestamptz default now()
);
alter table public.user_lookup enable row level security;
create policy "Lookup viewable by everyone" on public.user_lookup for select using (true);
create policy "Lookup insertable by authenticated" on public.user_lookup for insert with check (auth.role() = 'authenticated');

-- 10. VISITOR LOGS
create table if not exists public.visitor_logs (
  id uuid default uuid_generate_v4() primary key,
  page text,
  ip text, -- optional if we can get it
  user_agent text,
  created_at timestamptz default now()
);
alter table public.visitor_logs enable row level security;
create policy "Logs insertable by everyone" on public.visitor_logs for insert with check (true);
create policy "Logs viewable by admin" on public.visitor_logs for select using (auth.role() = 'authenticated');

-- 11. INDENT SUBMISSIONS (Internal)
create table if not exists public.indent_submissions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users,
  parent_name text,
  user_email text,
  student_name_candidate text,
  target_unit_id text,
  target_unit_name text,
  recommendation_doc text, -- Base64
  status text default 'pending',
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.indent_submissions enable row level security;
create policy "Indent subs viewable by owner" on public.indent_submissions for select using (auth.uid() = user_id);
create policy "Indent subs insertable by owner" on public.indent_submissions for insert with check (auth.uid() = user_id);
create policy "Indent subs all by admin" on public.indent_submissions for select using (auth.role() = 'authenticated');
create policy "Indent subs update by admin" on public.indent_submissions for update using (auth.role() = 'authenticated');


-- 12. PATHS (Jalur Pendaftaran)
create table if not exists public.paths (
    id text primary key,
    name text,
    description text,
    active boolean default true
);
alter table public.paths enable row level security;
create policy "Paths viewable by everyone" on public.paths for select using (true);

-- 13. SYSTEM LOGS
create table if not exists public.system_logs (
    id uuid default uuid_generate_v4() primary key,
    action text,
    user_id text,
    user_email text,
    details text,
    created_at timestamptz default now()
);
alter table public.system_logs enable row level security;
create policy "Sys logs all by admin" on public.system_logs for all using (auth.role() = 'authenticated');

-- 14. NOTIFICATIONS
create table if not exists public.notifications (
    id uuid default uuid_generate_v4() primary key,
    user_id text, -- 'admin' or UUID
    title text,
    message text,
    type text,
    read boolean default false,
    created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Notif viewable by owner" on public.notifications for select using (auth.uid()::text = user_id or user_id = 'admin'); -- Simplified
create policy "Notif insertable by authenticated" on public.notifications for insert with check (auth.role() = 'authenticated');

-- 15. PAYMENT CONFIG
create table if not exists public.payment_config (
    id text primary key, -- 'main'
    gateway_active text default 'manual',
    manual_banks jsonb,
    midtrans_client_key text,
    midtrans_server_key text,
    midtrans_merchant_id text,
    created_at timestamptz default now()
);
alter table public.payment_config enable row level security;
create policy "PayConfig viewable by everyone" on public.payment_config for select using (true);
create policy "PayConfig updateable by admin" on public.payment_config for update using (auth.role() = 'authenticated');
create policy "PayConfig insertable by admin" on public.payment_config for insert with check (auth.role() = 'authenticated');

-- 16. INDENT SETTINGS
create table if not exists public.indent_settings (
    id text primary key, -- 'main'
    active boolean default false,
    start_date date,
    end_date date,
    target_academic_years jsonb, -- ['2026/2027']
    created_at timestamptz default now()
);
alter table public.indent_settings enable row level security;
create policy "Indent Settings viewable by everyone" on public.indent_settings for select using (true);
create policy "Indent Settings updateable by admin" on public.indent_settings for update using (auth.role() = 'authenticated');
create policy "Indent Settings insertable by admin" on public.indent_settings for insert with check (auth.role() = 'authenticated');

-- 17. INDENTS (External/Internal Booking)
create table if not exists public.indents (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users,
    student_name text,
    parent_name text,
    parent_phone text,
    user_email text,
    target_unit text,
    target_year text,
    target_major text,
    indent_type text, -- 'internal', 'external'
    booking_fee integer,
    proof_of_transfer text,
    recommendation_letter text,
    status text default 'pending', -- pending, paid, rejected
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.indents enable row level security;
create policy "Indents viewable by owner" on public.indents for select using (auth.uid() = user_id);
create policy "Indents insertable by owner" on public.indents for insert with check (auth.uid() = user_id);
create policy "Indents all by admin" on public.indents for all using (auth.role() = 'authenticated');

-- 18. MARKETING RAB
create table if not exists public.marketing_rab (
    id uuid default uuid_generate_v4() primary key,
    name text,
    amount integer,
    category text, -- Iklan, Event, etc
    notes text,
    academic_year_id text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.marketing_rab enable row level security;
create policy "RAB all by admin" on public.marketing_rab for all using (auth.role() = 'authenticated');

-- 19. COUNTERS (For Invoice Numbers, etc.)
create table if not exists public.counters (
    id text primary key, -- 'invoices'
    count integer default 0,
    updated_at timestamptz default now()
);
alter table public.counters enable row level security;
-- 20. QUOTA ALLOCATIONS
create table if not exists public.quota_allocations (
    id uuid default uuid_generate_v4() primary key,
    academic_year text unique, -- e.g. '2025/2026' or ID
    internal integer default 0,
    indent_external integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.quota_allocations enable row level security;
create policy "QuotaAlloc viewable by everyone" on public.quota_allocations for select using (true);
create policy "QuotaAlloc all by admin" on public.quota_allocations for all using (auth.role() = 'authenticated');
