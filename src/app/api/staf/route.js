import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const cookieStore = await cookies();

    // =================================================================
    // 🛡️ FASE 1: VALIDASI KEAMANAN (Siapa yang memanggil API ini?)
    // =================================================================
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      },
    );

    // 1. Cek apakah orang ini login?
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Akses ditolak! Anda belum login." },
        { status: 401 },
      );
    }

    // 2. Cek apakah orang ini benar-benar ADMIN di database?
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ilegal! Hanya Admin yang boleh menambah staf." },
        { status: 403 },
      );
    }

    // =================================================================
    // ⚡ FASE 2: EKSEKUSI "GOD MODE" (Membuat Akun Baru)
    // =================================================================
    const { email, password, nama, role } = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Buat akun Auth
    const { data: authData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        // 👇 TAMBAHKAN BLOK INI:
        user_metadata: {
          nama_lengkap: nama,
          role: role,
        },
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const newUser = authData?.user;

    if (newUser) {
      // Masukkan ke tabel profiles
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([
          {
            id: newUser.id,
            nama_lengkap: nama,
            role: role,
          },
        ]);

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.id); // Rollback jika gagal
        return NextResponse.json(
          { error: profileError.message },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Staf berhasil didaftarkan!",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server" },
      { status: 500 },
    );
  }
}
