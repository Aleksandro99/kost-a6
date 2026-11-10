-- =====================================================================
-- MIGRASI: Status Kost -> Status Kamar
-- Jalankan di Supabase > SQL Editor
-- =====================================================================

-- 1. Tabel kamar (tetap, A1-A6 & B1-B4)
create table if not exists public.rooms (
  id            bigint generated always as identity primary key,
  room_number   text    not null unique,
  is_occupied   boolean not null default false,
  tenant_name   text,
  tenant_phone  text,                 -- format 62xxx, harus sama dengan allowed_users.phone
  price         integer not null default 0
);

insert into public.rooms (room_number) values
  ('A1'),('A2'),('A3'),('A4'),('A5'),('A6'),
  ('B1'),('B2'),('B3'),('B4')
on conflict (room_number) do nothing;

-- 2. monthly_payments sekarang mengacu ke kamar, bukan tenants
alter table public.monthly_payments add column if not exists room_id    bigint references public.rooms(id) on delete cascade;
alter table public.monthly_payments add column if not exists proof_path text;   -- path file di bucket private
alter table public.monthly_payments alter column tenant_id drop not null;

create unique index if not exists monthly_payments_room_month_uq
  on public.monthly_payments (room_id, month_year) where room_id is not null;

-- 3. RLS tabel rooms (pola sama dengan header x-kost-secret yang sudah dipakai)
alter table public.rooms enable row level security;

create or replace function public.kost_hdr(h text) returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json ->> h, '')
$$;

drop policy if exists rooms_read  on public.rooms;
drop policy if exists rooms_admin on public.rooms;
create policy rooms_read  on public.rooms for select
  using (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng');
create policy rooms_admin on public.rooms for all
  using      (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng' and public.kost_hdr('x-user-role') = 'admin')
  with check (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng' and public.kost_hdr('x-user-role') = 'admin');

-- 4. BUCKET BUKTI TRANSFER -> PRIVATE
--    (sebelumnya public: siapa pun yang tahu URL bisa membuka gambarnya)
update storage.buckets set public = false where id = 'receipts';

drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;

-- Lihat: admin, atau pemilik kamar (file diberi nama "<bulan>/<room_id>-xxx.jpg")
create policy receipts_select on storage.objects for select using (
  bucket_id = 'receipts'
  and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (
    public.kost_hdr('x-user-role') = 'admin'
    or exists (
      select 1 from public.rooms r
      where r.is_occupied
        and r.tenant_phone = public.kost_hdr('x-user-phone')
        and split_part(split_part(name, '/', 2), '-', 1) = r.id::text
    )
  )
);

-- Upload: admin, atau penghuni hanya ke folder kamarnya sendiri
create policy receipts_insert on storage.objects for insert with check (
  bucket_id = 'receipts'
  and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (
    public.kost_hdr('x-user-role') = 'admin'
    or exists (
      select 1 from public.rooms r
      where r.is_occupied
        and r.tenant_phone = public.kost_hdr('x-user-phone')
        and split_part(split_part(name, '/', 2), '-', 1) = r.id::text
    )
  )
);

-- Hapus: admin, atau pemilik kamar (dipakai saat upload ulang bukti)
create policy receipts_delete on storage.objects for delete using (
  bucket_id = 'receipts'
  and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (
    public.kost_hdr('x-user-role') = 'admin'
    or exists (
      select 1 from public.rooms r
      where r.is_occupied
        and r.tenant_phone = public.kost_hdr('x-user-phone')
        and split_part(split_part(name, '/', 2), '-', 1) = r.id::text
    )
  )
);

-- CATATAN: kalau monthly_payments sudah punya policy RLS sendiri, pastikan
-- kolom baru (room_id, proof_path) ikut diizinkan untuk insert/update/select.
