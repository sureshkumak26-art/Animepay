-- Persistent AnimePay merchant workspaces and team role assignments.
create table if not exists public.animepay_merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  slug text not null unique,
  contact_email text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.animepay_merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.animepay_merchants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','developer','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, email)
);

create index if not exists animepay_merchants_status_idx on public.animepay_merchants(status);
create index if not exists animepay_merchant_memberships_merchant_idx on public.animepay_merchant_memberships(merchant_id);
create index if not exists animepay_merchant_memberships_email_idx on public.animepay_merchant_memberships(lower(email));

alter table public.animepay_merchants enable row level security;
alter table public.animepay_merchant_memberships enable row level security;
revoke all on public.animepay_merchants from anon, authenticated;
revoke all on public.animepay_merchant_memberships from anon, authenticated;
grant all on public.animepay_merchants to service_role;
grant all on public.animepay_merchant_memberships to service_role;
