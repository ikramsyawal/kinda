import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error) {
            // Abaikan error manipulasi cookie jika ada konflik
          }
        },
      },
    },
  );

  // Perintah resmi Supabase untuk membunuh sesi dan cookie server
  await supabase.auth.signOut();

  // Beri sinyal ke frontend bahwa proses server sudah beres
  return NextResponse.json({ success: true });
}
