"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Plus,
  Edit3,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  percent,
  Coins,
} from "lucide-react";

export default function ManajemenProduk() {
  const [loading, setLoading] = useState(true);
  const [daftarProduk, setDaftarProduk] = useState([]);
  const [kataKunci, setKataKunci] = useState("");

  // State Fitur Sorting Tabel
  const [sortField, setSortField] = useState("nama_produk");
  const [sortOrder, setSortOrder] = useState("asc");

  // State Fitur Pagination Server-Side (10 Data per Halaman)
  const [halamanAktif, setHalamanAktif] = useState(1);
  const [totalBarisData, setTotalBarisData] = useState(0);
  const itemPerHalaman = 10;

  // State Form Modal & Opsi QoL Tambah Banyak Item
  const [modalTerbuka, setModalTerbuka] = useState(false);
  const [tetapBukaModal, setTetapBukaModal] = useState(false); // 👈 Fitur input kilat beruntun
  const [idEdit, setIdEdit] = useState(null);
  const [form, setForm] = useState({
    nama_produk: "",
    barcode: "",
    harga_modal: 0,
    harga_jual: 0,
    stok: 0,
    is_active: true,
  });

  // Muat ulang data secara otomatis ketika ada interaksi filter rute halaman
  useEffect(() => {
    muatDataProduk(halamanAktif);
  }, [halamanAktif, sortField, sortOrder, kataKunci]);

  const muatDataProduk = async (halaman) => {
    setLoading(true);
    try {
      const indeksMulai = (halaman - 1) * itemPerHalaman;
      const indeksSelesai = indeksMulai + itemPerHalaman - 1;

      // Bangun Kueri SQL Dinamis ke Supabase
      let query = supabase
        .from("produk")
        .select("*", { count: "exact" })
        .order(sortField, { ascending: sortOrder === "asc" })
        .range(indeksMulai, indeksSelesai);

      // Jika ada teks kata kunci di bar pencarian
      if (kataKunci.trim() !== "") {
        query = query.or(
          `nama_produk.ilike.%${kataKunci}%,barcode.like.%${kataKunci}%`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setDaftarProduk(data || []);
      setTotalBarisData(count || 0);
    } catch (error) {
      console.error("Gagal memuat produk:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nama_produk: form.nama_produk,
        barcode: form.barcode || null,
        harga_modal: Number(form.harga_modal),
        harga_jual: Number(form.harga_jual),
        stok: Number(form.stok),
        is_active: form.is_active,
      };

      if (idEdit) {
        const { error } = await supabase
          .from("produk")
          .update(payload)
          .eq("id", idEdit);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produk").insert([payload]);
        if (error) throw error;
      }

      // Jalankan Logika Kontrol Evaluasi Checklist QoL Tambah Banyak Item
      if (!idEdit && tetapBukaModal) {
        // Jika mode tambah baru dan kasir ingin lanjut menginput item berikutnya
        resetForm(); // Kosongkan form inputan agar siap diketik ulang
        muatDataProduk(halamanAktif); // Refresh background tabel
      } else {
        // Jika mode edit atau kasir tidak mencentang opsi tambah banyak
        setModalTerbuka(false);
        resetForm();
        muatDataProduk(halamanAktif);
      }
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  };

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);
    setHalamanAktif(1);
  };

  const picuEdit = (prod) => {
    setIdEdit(prod.id);
    setForm({
      nama_produk: prod.nama_produk,
      barcode: prod.barcode || "",
      harga_modal: prod.harga_modal,
      harga_jual: prod.harga_jual,
      stok: prod.stok,
      is_active: prod.is_active,
    });
    setModalTerbuka(true);
  };

  const resetForm = () => {
    setIdEdit(null);
    setForm({
      nama_produk: "",
      barcode: "",
      harga_modal: 0,
      harga_jual: 0,
      stok: 0,
      is_active: true,
    });
  };

  // Kalkulator Estimasi Persentase Profit Margin (QoL Premium)
  const untungNominal = Number(form.harga_jual) - Number(form.harga_modal);
  const persentaseMargin =
    form.harga_jual > 0
      ? Math.round((untungNominal / Number(form.harga_jual)) * 100)
      : 0;

  const totalHalaman = Math.ceil(totalBarisData / itemPerHalaman) || 1;

  const formatRupiah = (angka) => {
    if (!angka) return "";
    return Number(angka).toLocaleString("id-ID");
  };

  // Fungsi untuk membersihkan titik agar kembali menjadi angka murni sebelum disimpan ke state
  const bersihkanAngka = (teks) => {
    return teks.replace(/\./g, ""); // Menghapus semua karakter titik
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans flex flex-col space-y-5">
      {/* ================= HEADER CONTROL BAR (RAMPING & COMPACT) ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
            Gudang Inventaris Produk
          </h1>
        </div>

        <button
          onClick={() => {
            resetForm();
            setModalTerbuka(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer uppercase tracking-wider self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Item Baru</span>
        </button>
      </div>

      {/* Bar Pencarian Server-Side */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-3xs flex items-center space-x-3 flex-shrink-0">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Ketik nama produk atau scan barcode lalu tekan Enter untuk menyaring gudang..."
          value={kataKunci}
          onChange={(e) => {
            setKataKunci(e.target.value);
            setHalamanAktif(1); // Balikkan ke halaman awal jika kata kunci dicari
          }}
          className="bg-transparent text-sm text-slate-800 focus:outline-none w-full font-semibold"
        />
      </div>

      {/* ================= TABEL INVENTARIS DENGAN SORT & PAGINATION ================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden flex flex-col flex-1 min-h-[350px]">
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400">
              Menghubungkan ke server inventori cloud...
            </div>
          ) : daftarProduk.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-medium">
              Tidak ada produk yang terdaftar dalam inventaris gudang.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs shadow-3xs z-10">
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th
                    className="p-4 px-5 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("nama_produk")}
                  >
                    Nama Item{" "}
                    {sortField === "nama_produk"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("barcode")}
                  >
                    Barcode{" "}
                    {sortField === "barcode"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-4 text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("harga_modal")}
                  >
                    Harga Modal{" "}
                    {sortField === "harga_modal"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-4 text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("harga_jual")}
                  >
                    Harga Jual{" "}
                    {sortField === "harga_jual"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-4 text-center cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("stok")}
                  >
                    Stok{" "}
                    {sortField === "stok"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center px-5">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-semibold text-slate-700 divide-y divide-slate-50">
                {daftarProduk.map((prod) => (
                  <tr
                    key={prod.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-3.5 px-5 font-bold text-slate-900">
                      {prod.nama_produk}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      {prod.barcode || "-"}
                    </td>
                    <td className="p-3.5 text-right text-slate-400">
                      Rp {Number(prod.harga_modal).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-right text-emerald-600 font-bold">
                      Rp {Number(prod.harga_jual).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded ${prod.stok <= 5 ? "bg-rose-50 text-rose-600 font-black animate-pulse" : "text-slate-800"}`}
                      >
                        {prod.stok}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase ${prod.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-400"}`}
                      >
                        {prod.is_active ? "Aktif" : "Sembunyi"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center px-5">
                      <button
                        onClick={() => picuEdit(prod)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                        title="Ubah Detail Produk"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================= PANEL FOOTER PAGINATION ================= */}
        <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0 text-xs font-bold text-slate-500">
          <p>
            Halaman {halamanAktif} dari {totalHalaman} ({totalBarisData} item
            terdaftar)
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHalamanAktif((prev) => Math.max(prev - 1, 1))}
              disabled={halamanAktif === 1 || loading}
              className="p-1.5 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-1">
              {[...Array(totalHalaman)].map((_, indeks) => {
                const nomor = indeks + 1;
                if (
                  nomor === 1 ||
                  nomor === totalHalaman ||
                  Math.abs(nomor - halamanAktif) <= 1
                ) {
                  return (
                    <button
                      key={nomor}
                      onClick={() => setHalamanAktif(nomor)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] transition-all cursor-pointer ${halamanAktif === nomor ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {nomor}
                    </button>
                  );
                }
                if (nomor === 2 || nomor === totalHalaman - 1)
                  return (
                    <span key={nomor} className="px-0.5 text-slate-300">
                      ...
                    </span>
                  );
                return null;
              })}
            </div>

            <button
              onClick={() =>
                setHalamanAktif((prev) => Math.min(prev + 1, totalHalaman))
              }
              disabled={halamanAktif === totalHalaman || loading}
              className="p-1.5 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= FORM MODAL POP-UP DENGAN REALTIME MARGIN CALCULATOR ================= */}
      {modalTerbuka && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <form
            onSubmit={simpanProduk}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="p-4 px-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                {idEdit ? "Ubah Rincian Item" : "Daftarkan Item Dagangan Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                  Nama Item Produk *
                </label>
                <input
                  required
                  type="text"
                  value={form.nama_produk}
                  onChange={(e) =>
                    setForm({ ...form, nama_produk: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-slate-400 text-sm font-bold text-slate-900 bg-slate-50/50"
                  placeholder="Contoh: Kopi Susu Premium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                  Kode Barcode (Opsional)
                </label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-slate-400 text-sm font-mono text-slate-900 bg-slate-50/50"
                  placeholder="Scan atau input kode batang produk"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* INPUT HARGA MODAL */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                    Harga Modal (Rp) *
                  </label>
                  <input
                    required
                    type="text" // 👈 Ubah ke text agar bisa menampilkan format titik
                    inputMode="numeric" // 👈 Tetap munculkan keyboard angka di HP
                    value={formatRupiah(form.harga_modal)} // 👈 Format otomatis ke "15.000"
                    onChange={(e) => {
                      const nilaiBersih = bersihkanAngka(e.target.value);
                      // Pastikan yang diinput hanya angka
                      if (!isNaN(nilaiBersih)) {
                        setForm({ ...form, harga_modal: nilaiBersih });
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-slate-400 text-sm font-bold text-slate-900 bg-slate-50/50"
                    placeholder="0"
                  />
                </div>

                {/* INPUT HARGA JUAL */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                    Harga Jual (Rp) *
                  </label>
                  <input
                    required
                    type="text" // 👈 Ubah ke text
                    inputMode="numeric"
                    value={formatRupiah(form.harga_jual)} // 👈 Format otomatis ke "25.000"
                    onChange={(e) => {
                      const nilaiBersih = bersihkanAngka(e.target.value);
                      if (!isNaN(nilaiBersih)) {
                        setForm({ ...form, harga_jual: nilaiBersih });
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-slate-400 text-sm font-bold text-emerald-600 bg-slate-50/50"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 📊 INTERAKTIF MARGIN CALCULATOR PANEL */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center space-x-2 text-slate-500">
                  <Coins className="h-4 w-4 text-slate-400" />
                  <span>Estimasi Profit:</span>
                  <span
                    className={
                      untungNominal >= 0
                        ? "text-slate-900 font-extrabold"
                        : "text-rose-600 font-extrabold"
                    }
                  >
                    Rp {untungNominal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-500">
                  <span>Margin:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${persentaseMargin >= 20 ? "bg-emerald-100 text-emerald-800" : persentaseMargin > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}
                  >
                    {persentaseMargin}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-1">
                <div>
                  <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                    Jumlah Kuantitas Stok *
                  </label>
                  <input
                    required
                    type="number"
                    value={form.stok}
                    onChange={(e) => setForm({ ...form, stok: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-slate-400 text-sm font-bold text-slate-900 bg-slate-50/50"
                  />
                </div>
                <div className="flex items-center h-full pt-4">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.checked })
                      }
                      className="rounded text-slate-950 focus:ring-slate-900 h-4 w-4 cursor-pointer"
                    />
                    <span>Aktifkan Menu</span>
                  </label>
                </div>
              </div>

              {/* ⚡ 4. OPSI QoL UTAMA: SAKLAR TAMBAH BERUNTUN (HANYA MUNCUL DI MODE TAMBAH BARU) */}
              {!idEdit && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center space-x-2 bg-slate-900 text-white p-2.5 rounded-xl cursor-pointer shadow-xs select-none transition-all hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={tetapBukaModal}
                      onChange={(e) => setTetapBukaModal(e.target.checked)}
                      className="rounded text-slate-950 focus:ring-white h-4 w-4 cursor-pointer bg-white"
                    />
                    <div className="text-[10px] font-bold">
                      <p className="uppercase tracking-wide font-black">
                        Mode Input Kilat Beruntun
                      </p>
                      <p className="text-slate-400 text-[9px] font-medium font-sans">
                        Form akan otomatis dikosongkan setelah klik simpan agar
                        bisa langsung mengetik produk berikutnya.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer uppercase tracking-wider"
              >
                {idEdit ? "Simpan Perubahan" : "Konfirmasi Masuk"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
