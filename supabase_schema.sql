-- مسودة تصميم فقط (غير منفَّذة). Postgres / Supabase.
create table customers (
  id uuid primary key, owner_id uuid not null default auth.uid(),
  name text not null, code text, phone text, sector text, district text, address text,
  lat double precision, lng double precision, class text, status text, freq int,
  grp text, ord int, notes text, custom jsonb default '{}', source text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table visits (
  id uuid primary key, owner_id uuid not null default auth.uid(),
  customer_id uuid not null references customers(id),
  at timestamptz not null, date date not null, outcome text not null,
  done boolean not null, sale boolean not null, follow boolean not null,
  notes text, next_date date, follow_date date, unplanned boolean default false, plan_id text,
  cancelled boolean default false, cancel_reason text, history jsonb default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table tasks (
  id uuid primary key, owner_id uuid not null default auth.uid(),
  customer_id uuid not null references customers(id), visit_id uuid references visits(id),
  title text, due date, status text not null, result text, done_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table plans (
  id uuid primary key, owner_id uuid not null default auth.uid(),
  date date not null, cap int, items jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, date)
);
create table orders (  -- المرحلة 4 (timeline و items مخزَّنان كـ jsonb ويُحتفظ بهما كاملين)
  id uuid primary key, owner_id uuid not null default auth.uid(),
  no text not null, customer_id uuid not null references customers(id), visit_id uuid references visits(id),
  date date not null, created_at timestamptz not null, items jsonb not null, discount numeric default 0, total numeric not null,
  notes text, expected_date date, status text not null, stalled boolean default false, stalled_reason text,
  carrier text, tracking text, ship_date date, expected_arrival date, delivered_at timestamptz,
  timeline jsonb not null default '[]', updated_at timestamptz not null default now(),
  unique (owner_id, no)
);
create unique index orders_one_live_per_visit on orders (owner_id, visit_id) where visit_id is not null and status <> 'cancelled';
alter table tasks add column order_id uuid references orders(id), add column key text;
create table settings (owner_id uuid not null default auth.uid(), key text not null, value jsonb, updated_at timestamptz default now(), primary key (owner_id, key));
create table custom_fields (id uuid primary key, owner_id uuid not null default auth.uid(), entity text, label text, type text, options jsonb, updated_at timestamptz default now());
create table audit_log (id uuid primary key, owner_id uuid not null default auth.uid(), at timestamptz, action text, store text, rid text, note text);
create index on visits (owner_id, customer_id, date);
create index on customers (owner_id, updated_at);
-- أمان: RLS لكل جدول (مثال)
alter table customers enable row level security;
create policy own_rows on customers for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- كرّر السياسة لبقية الجداول. لا تستخدم مفتاح service_role في الواجهة.
