-- =====================================================================
-- MIGRASI PRIVASI
--  1. Tabel transactions (laporan keuangan) -> hanya ADMIN
--  2. Tabel rooms (harga & no HP)           -> penghuni hanya bisa lihat
--     milik kamarnya sendiri, lewat fungsi get_rooms()
-- Jalankan di Supabase > SQL Editor (setelah migration_status_kamar.sql)
-- =====================================================================

-- ---------- 1. LAPORAN KEUANGAN: ADMIN SAJA ----------
alter table public.transactions enable row level security;

-- hapus semua policy lama di transactions (nama lama tidak diketahui)
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'transactions' loop
    execute format('drop policy %I on public.transactions', p.policyname);
  end loop;
end $$;

create policy transactions_admin_only on public.transactions for all
  using      (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng' and public.kost_hdr('x-user-role') = 'admin')
  with check (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng' and public.kost_hdr('x-user-role') = 'admin');

-- ---------- 2. HARGA KAMAR: ADMIN + PEMILIK KAMAR ----------
-- Helper: apakah user yang login adalah penghuni kamar dengan id tsb?
-- (security definer supaya tetap jalan walau tabel rooms dikunci untuk non-admin)
create or replace function public.kost_owns_room(rid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms r
    where r.is_occupied
      and r.tenant_phone = public.kost_hdr('x-user-phone')
      and public.kost_hdr('x-user-phone') <> ''
      and r.id::text = rid
  )
$$;
grant execute on function public.kost_owns_room(text) to anon, authenticated;

-- Fungsi baca kamar untuk penghuni: harga & no HP hanya terisi untuk kamarnya sendiri
create or replace function public.get_rooms()
returns table (
  id bigint, room_number text, is_occupied boolean, tenant_name text,
  tenant_phone text, price integer, is_mine boolean
)
language sql stable security definer set search_path = public as $$
  select r.id, r.room_number, r.is_occupied, r.tenant_name,
         case when a.is_admin or m.mine then r.tenant_phone end,
         case when a.is_admin or m.mine then r.price end,
         m.mine
  from public.rooms r
  cross join lateral (select public.kost_hdr('x-user-role') = 'admin' as is_admin) a
  cross join lateral (select (r.is_occupied
                              and public.kost_hdr('x-user-phone') <> ''
                              and r.tenant_phone = public.kost_hdr('x-user-phone')) as mine) m
  where public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  order by r.room_number
$$;
grant execute on function public.get_rooms() to anon, authenticated;

-- Tabel rooms sekarang hanya bisa dibaca langsung oleh admin
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select
  using (public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng' and public.kost_hdr('x-user-role') = 'admin');

-- Policy storage dipindah ke helper di atas (subquery ke rooms tadinya
-- akan kosong untuk penghuni karena rooms sudah dikunci)
drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_select on storage.objects for select using (
  bucket_id = 'receipts' and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (public.kost_hdr('x-user-role') = 'admin'
       or public.kost_owns_room(split_part(split_part(name, '/', 2), '-', 1)))
);
create policy receipts_insert on storage.objects for insert with check (
  bucket_id = 'receipts' and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (public.kost_hdr('x-user-role') = 'admin'
       or public.kost_owns_room(split_part(split_part(name, '/', 2), '-', 1)))
);
create policy receipts_delete on storage.objects for delete using (
  bucket_id = 'receipts' and public.kost_hdr('x-kost-secret') = 'sukaMakanNasiGoreng'
  and (public.kost_hdr('x-user-role') = 'admin'
       or public.kost_owns_room(split_part(split_part(name, '/', 2), '-', 1)))
);
