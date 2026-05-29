import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata = {
  title: "Aplikasi POS BS SMKN 2",
  description: "Sistem Kasir Toko BS SMKN 2",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();

  // 1. Inisialisasi server client instan untuk membaca cookie resmi
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
          } catch {
            // Abaikan jika dijalankan di Server Component biasa (Next.js batasan set cookie di layout)
          }
        },
      },
    },
  );

  // 2. AMANKAN: Validasi token token kriptografis langsung ke server auth Supabase
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let userProfile = null;

  // 3. JIKA USER VALID, AMBIL ROLE ASLI DARI DATABASE (Bukan dari JWT Cookie usang)
  if (user && !authError) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, nama_lengkap, role")
      .eq("id", user.id)
      .single();

    if (!profileError && profile) {
      // Data berhasil diambil langsung dari database ter-update
      userProfile = profile;
    } else {
      // Cadangan darurat jika data baris profil di database belum terbuat
      userProfile = {
        id: user.id,
        nama_lengkap:
          user.user_metadata?.nama_lengkap || user.email.split("@")[0],
        role: "kasir",
      };
    }
  }

  return (
    <html lang="id">
      <body className="bg-slate-50 antialiased">
        {/* Menyuapi Navbar data bersih dan mutakhir dari sisi server */}
        <Navbar userAwal={userProfile} />
        <main>{children}</main>
      </body>
    </html>
  );
}
