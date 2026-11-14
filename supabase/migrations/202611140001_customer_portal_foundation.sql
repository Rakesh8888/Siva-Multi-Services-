-- SIVA MULTI SERVICES customer portal foundation
-- Apply in Supabase SQL Editor. No customer data or secrets belong in this file.
-- Explicit exclusions: people/document services and ticket bookings.

create extension if not exists pgcrypto;

create sequence if not exists public.customer_code_seq;

create or replace function public.generate_customer_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'SMS-' || to_char(current_date, 'YYYY') || '-' ||
         lpad(nextval('public.customer_code_seq')::text, 6, '0');
$$;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_code text not null unique default public.generate_customer_code(),
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the auth trigger creates customer profiles. It never trusts a client-supplied role.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles (user_id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_siva on auth.users;
create trigger on_auth_user_created_siva
after insert on auth.users
for each row execute procedure public.handle_new_customer();

create or replace function public.is_siva_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customer_profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

create table if not exists public.service_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  service_type text not null check (service_type in (
    'visa_assistance',
    'tourism_tour_package',
    'overseas_job_assistance',
    'cruise_job_assistance',
    'crm_erp_billing_support'
  )),
  title text not null,
  country_or_destination text,
  case_status text not null default 'enquiry_received' check (case_status in (
    'enquiry_received','documents_pending','documents_received',
    'verification_in_progress','application_in_progress',
    'waiting_for_third_party','completed','on_hold','cancelled'
  )),
  total_fee_paise bigint not null default 0 check (total_fee_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes_for_customer text
);

create table if not exists public.case_payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.service_cases(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  entry_type text not null default 'payment' check (entry_type in ('payment','refund','adjustment')),
  amount_paise bigint not null check (amount_paise > 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','verified','failed')),
  payment_method text,
  transaction_reference text,
  receipt_number text unique,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.customer_profiles(user_id)
);

-- Ledger is append-only for customers. Corrections should be new adjustment/refund entries.
create or replace function public.check_payment_case_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare case_owner uuid;
begin
  select customer_id into case_owner from public.service_cases where id = new.case_id;
  if case_owner is null or case_owner <> new.customer_id then
    raise exception 'Payment customer must match the service case customer';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_siva_payment_owner on public.case_payments;
create trigger validate_siva_payment_owner
before insert or update on public.case_payments
for each row execute procedure public.check_payment_case_owner();

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.service_cases(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  document_type text not null,
  storage_path text not null unique,
  original_file_name text,
  verification_status text not null default 'received' check (verification_status in (
    'received','under_review','verified','rejected','reupload_required'
  )),
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.customer_profiles(user_id),
  customer_message text
);

create or replace function public.check_document_case_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare case_owner uuid;
begin
  select customer_id into case_owner from public.service_cases where id = new.case_id;
  if case_owner is null or case_owner <> new.customer_id then
    raise exception 'Document customer must match the service case customer';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.customer_id::text then
    raise exception 'Document storage path must start with the customer user ID';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_siva_document_owner on public.case_documents;
create trigger validate_siva_document_owner
before insert or update on public.case_documents
for each row execute procedure public.check_document_case_owner();

create table if not exists public.case_activity (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.service_cases(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  event_title text not null,
  event_details text,
  visible_to_customer boolean not null default true,
  created_by uuid references public.customer_profiles(user_id),
  created_at timestamptz not null default now()
);

create or replace function public.check_activity_case_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare case_owner uuid;
begin
  select customer_id into case_owner from public.service_cases where id = new.case_id;
  if case_owner is null or case_owner <> new.customer_id then
    raise exception 'Activity customer must match the service case customer';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_siva_activity_owner on public.case_activity;
create trigger validate_siva_activity_owner
before insert or update on public.case_activity
for each row execute procedure public.check_activity_case_owner();

-- Read-only balance view: payments count only after admin verification.
create or replace view public.customer_case_balances
with (security_invoker = true)
as
select
  c.id as case_id,
  c.customer_id,
  c.total_fee_paise,
  c.discount_paise,
  coalesce(sum(
    case
      when p.payment_status = 'verified' and p.entry_type = 'payment' then p.amount_paise
      when p.payment_status = 'verified' and p.entry_type in ('refund','adjustment') then -p.amount_paise
      else 0
    end
  ), 0)::bigint as net_paid_paise,
  greatest(
    c.total_fee_paise - c.discount_paise -
    coalesce(sum(
      case
        when p.payment_status = 'verified' and p.entry_type = 'payment' then p.amount_paise
        when p.payment_status = 'verified' and p.entry_type in ('refund','adjustment') then -p.amount_paise
        else 0
      end
    ), 0),
    0
  )::bigint as balance_paise,
  c.currency
from public.service_cases c
left join public.case_payments p on p.case_id = c.id
group by c.id, c.customer_id, c.total_fee_paise, c.discount_paise, c.currency;

alter table public.customer_profiles enable row level security;
alter table public.service_cases enable row level security;
alter table public.case_payments enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_activity enable row level security;

drop policy if exists "profile read own or admin" on public.customer_profiles;
create policy "profile read own or admin" on public.customer_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_siva_admin());

drop policy if exists "profile update own or admin" on public.customer_profiles;
create policy "profile update own or admin" on public.customer_profiles
for update to authenticated
using (user_id = auth.uid() or public.is_siva_admin())
with check (user_id = auth.uid() or public.is_siva_admin());

drop policy if exists "cases read own or admin" on public.service_cases;
create policy "cases read own or admin" on public.service_cases
for select to authenticated
using (customer_id = auth.uid() or public.is_siva_admin());

drop policy if exists "cases admin manage" on public.service_cases;
create policy "cases admin manage" on public.service_cases
for all to authenticated
using (public.is_siva_admin())
with check (public.is_siva_admin());

drop policy if exists "payments read own or admin" on public.case_payments;
create policy "payments read own or admin" on public.case_payments
for select to authenticated
using (customer_id = auth.uid() or public.is_siva_admin());

drop policy if exists "payments admin insert" on public.case_payments;
create policy "payments admin insert" on public.case_payments
for insert to authenticated
with check (public.is_siva_admin());

drop policy if exists "payments admin update" on public.case_payments;
create policy "payments admin update" on public.case_payments
for update to authenticated
using (public.is_siva_admin())
with check (public.is_siva_admin());

drop policy if exists "documents read own or admin" on public.case_documents;
create policy "documents read own or admin" on public.case_documents
for select to authenticated
using (customer_id = auth.uid() or public.is_siva_admin());

drop policy if exists "documents customer upload metadata" on public.case_documents;
create policy "documents customer upload metadata" on public.case_documents
for insert to authenticated
with check (customer_id = auth.uid() and verification_status = 'received');

drop policy if exists "documents admin review" on public.case_documents;
create policy "documents admin review" on public.case_documents
for update to authenticated
using (public.is_siva_admin())
with check (public.is_siva_admin());

drop policy if exists "activity read visible own or admin" on public.case_activity;
create policy "activity read visible own or admin" on public.case_activity
for select to authenticated
using ((customer_id = auth.uid() and visible_to_customer) or public.is_siva_admin());

drop policy if exists "activity admin manage" on public.case_activity;
create policy "activity admin manage" on public.case_activity
for all to authenticated
using (public.is_siva_admin())
with check (public.is_siva_admin());

-- Customer profile fields customers may change; role and customer_code are not client-editable.
revoke all on public.customer_profiles from anon;
revoke insert, delete on public.customer_profiles from authenticated;
revoke update on public.customer_profiles from authenticated;
grant select on public.customer_profiles to authenticated;
grant update (full_name, phone) on public.customer_profiles to authenticated;

grant select on public.service_cases, public.case_payments, public.case_documents, public.case_activity, public.customer_case_balances to authenticated;
grant insert, update, delete on public.service_cases to authenticated;
grant insert, update on public.case_payments to authenticated;
grant insert, update on public.case_documents to authenticated;
grant insert, update, delete on public.case_activity to authenticated;

-- Private document bucket. Object paths must be: <auth-user-uuid>/<random-file-name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'siva-private-documents',
  'siva-private-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "siva docs read own or admin" on storage.objects;
create policy "siva docs read own or admin" on storage.objects
for select to authenticated
using (
  bucket_id = 'siva-private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  or (bucket_id = 'siva-private-documents' and public.is_siva_admin())
);

drop policy if exists "siva docs upload own folder" on storage.objects;
create policy "siva docs upload own folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'siva-private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "siva docs delete own or admin" on storage.objects;
create policy "siva docs delete own or admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'siva-private-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_siva_admin())
);

-- IMPORTANT:
-- 1) Promote the first trusted administrator manually in Supabase SQL Editor:
--    update public.customer_profiles set role = 'admin' where user_id = '<AUTH_USER_UUID>';
-- 2) Never expose the Supabase service_role key in browser code or GitHub.
-- 3) Configure customer sign-up and email/OTP verification before production.
-- 4) Test RLS with two separate customer accounts and one admin account.
-- 5) Do not store People/Document Services or flight/train/bus ticket-booking cases here.
