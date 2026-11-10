import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Header dibaca ULANG di setiap request, supaya langsung ikut berubah
// setelah login/logout (sebelumnya hanya dibaca sekali saat aplikasi dimuat).
const fetchWithSession: typeof fetch = (input, init) => {
  let session: { role?: string; phone?: string } = {};
  try {
    session = JSON.parse(localStorage.getItem('kost_session') || '{}');
  } catch {
    session = {};
  }
  const headers = new Headers(init?.headers);
  headers.set('x-user-role', session.role || 'guest');
  headers.set('x-user-phone', session.phone || '');
  headers.set('x-kost-secret', 'sukaMakanNasiGoreng');
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithSession },
});
