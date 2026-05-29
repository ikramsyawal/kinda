import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // ATURAN 1: Jika belum login, cegah masuk ke halaman admin/kasir/riwayat
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/kasir") ||
    pathname.startsWith("/riwayat");
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ==========================================================
  // ATURAN SETELAH LOGIN (Berdasarkan Role)
  // ==========================================================
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "kasir";

    // 🛡️ ATURAN PROTEKSI ROLE KASIR
    // Kasir hanya ditendang ke /kasir jika dia mencoba mengakses halaman selain /kasir, /riwayat, dan /login
    if (
      role === "kasir" &&
      !pathname.startsWith("/kasir") &&
      !pathname.startsWith("/riwayat") && // 👈 IZIN BARU: Kasir sekarang bisa buka /riwayat
      pathname !== "/login"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/kasir";
      return NextResponse.redirect(url); // Tendang balik ke /kasir jika mencoba masuk ke /admin
    }

    // 🛡️ ATURAN PROTEKSI ROLE ADMIN
    if (role === "admin" && (pathname === "/login" || pathname === "/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/staf";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
