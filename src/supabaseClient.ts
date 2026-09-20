import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const getRole = () => {
  if (typeof window !== 'undefined') {
    const session = JSON.parse(localStorage.getItem('kost_session') || '{}');
    return session.role || 'guest';
  }
  return 'guest';
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-user-role': getRole(),
      'x-kost-secret': 'sukaMakanNasiGoreng' // <-- INI PASSWORD RAHASIANYA
    }
  }
});