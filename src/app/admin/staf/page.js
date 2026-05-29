"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  UserCheck,
  Shield,
  RefreshCw,
  Search,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export default function KelolaStaf() {
  // State Tabel Data
  const [stafList, setStafList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAksi, setLoadingAksi] = useState(null);
  const [pencarian, setPencarian] = useState("");

  // State Form Tambah Staf
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("kasir");
  const [loadingTambah, setLoadingTambah] = useState(false);
  const [notif, setNotif] = useState({ tipe: "", pesan: "" });

  // 1. Ambil Data
  const ambilDaftarStaf = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nama_lengkap, role")
      .order("nama_lengkap", { ascending: true });

    if (!error && data) setStafList(data);
    setLoading(false);
  };

  useEffect(() => {
    ambilDaftarStaf();
  }, []);

  // 2. Fungsi Tambah Staf (Menembak API Route)
  const tanganiTambahStaf = async (e) => {
    e.preventDefault();
    setLoadingTambah(true);
    setNotif({ tipe: "", pesan: "" });

    if (password.length < 6) {
      setNotif({ tipe: "error", pesan: "Password minimal 6 karakter!" });
      setLoadingTambah(false);
      return;
    }

    try {
      const respon = await fetch("/api/staf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nama, role }),
      });

      const hasil = await respon.json();

      if (!respon.ok) throw new Error(hasil.error || "Gagal mendaftarkan staf");

      setNotif({ tipe: "sukses", pesan: `Akun ${nama} berhasil aktif!` });

      // Reset Form & Refresh Tabel
      setNama("");
      setEmail("");
      setPassword("");
      setRole("kasir");
      ambilDaftarStaf();
    } catch (err) {
      setNotif({ tipe: "error", pesan: err.message });
    } finally {
      setLoadingTambah(false);
    }
  };

  // 3. Fungsi Ubah Role
  const ubahRoleStaf = async (userId, roleSaatIni) => {
    const roleBaru = roleSaatIni === "admin" ? "kasir" : "admin";
    const konfirmasi = window.confirm(
      `Ubah hak akses staf menjadi ${roleBaru.toUpperCase()}?`,
    );
    if (!konfirmasi) return;

    setLoadingAksi(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: roleBaru })
      .eq("id", userId);

    if (error) {
      alert("Gagal mengubah role: " + error.message);
    } else {
      setStafList((prev) =>
        prev.map((staf) =>
          staf.id === userId ? { ...staf, role: roleBaru } : staf,
        ),
      );
    }
    setLoadingAksi(null);
  };

  const stafTerfilter = stafList.filter((staf) =>
    staf.nama_lengkap.toLowerCase().includes(pencarian.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-950 flex items-center space-x-2">
          <Users className="h-6 w-6 text-slate-900" />
          <span>Manajemen Kontrol Staf</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Pendaftaran staf baru dan pengaturan otoritas akun toko BS SMKN 2
          dalam satu tempat.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* BAGIAN KIRI: FORM */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
          <h2 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 mb-4">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            <span>Tambah Staf Baru</span>
          </h2>

          {notif.tipe === "sukses" && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{notif.pesan}</span>
            </div>
          )}
          {notif.tipe === "error" && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center space-x-2 text-xs font-bold">
              <ShieldAlert className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{notif.pesan}</span>
            </div>
          )}

          <form onSubmit={tanganiTambahStaf} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                placeholder="Nama staf"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                Email Login
              </label>
              <input
                type="email"
                required
                placeholder="staf@smkn2.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="Min 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                Otoritas (Role)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 bg-white text-slate-700"
              >
                <option value="kasir">KASIR (Akses Terbatas)</option>
                <option value="admin">ADMIN (Akses Penuh)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loadingTambah}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 mt-1"
            >
              {loadingTambah ? "Memproses..." : "Daftarkan Staf"}
            </button>
          </form>
        </div>

        {/* BAGIAN KANAN: TABEL */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama staf..."
                value={pencarian}
                onChange={(e) => setPencarian(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-400 w-full bg-slate-50"
              />
            </div>
            <button
              onClick={ambilDaftarStaf}
              className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-xs font-bold text-slate-500">
                Memuat data staf...
              </div>
            ) : stafTerfilter.length === 0 ? (
              <div className="py-16 text-center text-xs font-bold text-slate-500">
                Tidak ada staf terdaftar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-[11px] font-black text-slate-700 uppercase">
                        Nama Staf
                      </th>
                      <th className="p-3 text-[11px] font-black text-slate-700 uppercase">
                        Status Role
                      </th>
                      <th className="p-3 text-[11px] font-black text-slate-700 uppercase text-right">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stafTerfilter.map((staf) => (
                      <tr
                        key={staf.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-3">
                          <p className="text-xs font-black text-slate-900">
                            {staf.nama_lengkap}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {staf.id}
                          </p>
                        </td>
                        <td className="p-3">
                          {staf.role === "admin" ? (
                            <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white">
                              <Shield className="h-2.5 w-2.5" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              <UserCheck className="h-2.5 w-2.5" />
                              <span>Kasir</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => ubahRoleStaf(staf.id, staf.role)}
                            disabled={loadingAksi !== null}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all ${
                              staf.role === "admin"
                                ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                            } disabled:opacity-50`}
                          >
                            {loadingAksi === staf.id
                              ? "..."
                              : staf.role === "admin"
                                ? "Jadikan Kasir"
                                : "Jadikan Admin"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
