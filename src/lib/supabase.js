import { createClient } from "@/utils/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Instansi tunggal (Single Instance) untuk seluruh aplikasi client-side
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Biarkan sistem SSR/Cookie bawaanmu yang mengelola token
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
