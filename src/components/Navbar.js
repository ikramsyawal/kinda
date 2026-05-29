"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  LayoutDashboard,
  ShoppingCart,
  LogOut,
  Package,
  Users,
  Menu,
  X,
  History, // 👈 TAMBAHKAN IKON INI
} from "lucide-react";
import Link from "next/link";

export default function Navbar({ userAwal }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState(userAwal);
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  useEffect(() => {
    setUserProfile(userAwal);
  }, [userAwal]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (user && !authError) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, nama_lengkap, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    setMenuTerbuka(false);
  }, [pathname]);

  const tanganiLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUserProfile(null);
      router.refresh();
      router.replace("/login");
    } catch (error) {
      console.error("Gagal saat logout:", error);
    }
  };

  if (pathname === "/login") return null;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* SISI KIRI: LOGO & NAVIGASI DESKTOP */}
          <div className="flex items-center space-x-6">
            <Link
              href={userProfile?.role === "admin" ? "/admin" : "/kasir"}
              className="flex-shrink-0 flex items-center cursor-pointer"
            >
              <span className="text-xl font-black text-slate-900 tracking-tight">
                BS <span className="text-emerald-600">SMKN 2</span>
              </span>
            </Link>

            {userProfile && (
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  href="/kasir"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/kasir"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Mesin Kasir</span>
                </Link>

                {/* 📜 TOMBOL RIWAYAT UNTUK SEMUA ROLE (DESKTOP) */}
                <Link
                  href="/riwayat"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/riwayat"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Riwayat & Retur</span>
                </Link>

                {userProfile.role === "admin" && (
                  <>
                    <Link
                      href="/admin"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        pathname === "/admin"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Ringkasan & Jurnal</span>
                    </Link>

                    <Link
                      href="/admin/produk"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        pathname.startsWith("/admin/produk")
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Package className="h-4 w-4" />
                      <span>Stok Produk</span>
                    </Link>

                    <Link
                      href="/admin/staf"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        pathname.startsWith("/admin/staf")
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>Kelola Staf</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SISI KANAN */}
          <div className="hidden md:flex items-center space-x-4">
            {userProfile && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">
                    {userProfile.nama_lengkap}
                  </p>
                  <span className="inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 mt-0.5 tracking-wider">
                    {userProfile.role}
                  </span>
                </div>
                <button
                  onClick={tanganiLogout}
                  className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* TOMBOL MOBILE HAMBURGER */}
          <div className="flex items-center md:hidden">
            {userProfile && (
              <button
                onClick={() => setMenuTerbuka(!menuTerbuka)}
                className="text-slate-500 hover:text-slate-900 p-2 rounded-xl"
              >
                {menuTerbuka ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PANEL MENU MOBILE */}
      {menuTerbuka && userProfile && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-2 pb-4 space-y-1.5 shadow-inner">
          <Link
            href="/kasir"
            className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-bold ${
              pathname === "/kasir"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600"
            }`}
          >
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            <span>Mesin Kasir</span>
          </Link>

          {/* 📜 TOMBOL RIWAYAT (MOBILE) */}
          <Link
            href="/riwayat"
            className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-bold ${
              pathname === "/riwayat"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            <History className="h-5 w-5" />
            <span>Riwayat & Retur</span>
          </Link>

          {userProfile.role === "admin" && (
            <>
              <Link
                href="/admin"
                className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-bold ${
                  pathname === "/admin"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Ringkasan & Jurnal</span>
              </Link>
              <Link
                href="/admin/produk"
                className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-bold ${
                  pathname.startsWith("/admin/produk")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                <Package className="h-5 w-5" />
                <span>Stok Produk</span>
              </Link>
              <Link
                href="/admin/staf"
                className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-bold ${
                  pathname.startsWith("/admin/staf")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                <Users className="h-5 w-5" />
                <span>Kelola Staf</span>
              </Link>
            </>
          )}

          {/* DETAIL PROFIL SISI MOBILE */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-900">
                {userProfile.nama_lengkap}
              </p>
              <span className="inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 mt-0.5">
                {userProfile.role}
              </span>
            </div>
            <button
              onClick={tanganiLogout}
              className="flex items-center space-x-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
