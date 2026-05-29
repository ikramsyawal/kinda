import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Catatan: Pastikan di .env.local kamu namanya NEXT_PUBLIC_SUPABASE_ANON_KEY ya!

export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
