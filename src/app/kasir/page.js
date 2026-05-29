"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  X,
  ShoppingCart,
  History,
  CreditCard,
  Receipt,
} from "lucide-react";

export default function KasirPage() {
  const supabase = createClient();

  // State Utama Produk & Keranjang
  const [daftarProduk, setDaftarProduk] = useState([]);
  const [keranjang, setKeranjang] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState("");

  // State Fitur Sorting
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  // State Modal Pembayaran
  const [isModalTerbuka, setIsModalTerbuka] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState(null);
  const [inputUangTunai, setInputUangTunai] = useState("");
  const [konfirmasiQRIS, setKonfirmasiQRIS] = useState(false);

  // State Mobile QoL Switcher (Untuk buka/tutup keranjang di HP)
  const [bukaKeranjangMobile, setBukaKeranjangMobile] = useState(false);

  // State History Transaksi
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  const [transaksiTerakhir, setTransaksiTerakhir] = useState(null);

  const [modalDetailTransaksi, setModalDetailTransaksi] = useState(null);
  const [itemDetailTransaksi, setItemDetailTransaksi] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 1. Ambil data produk & riwayat transaksi dari Supabase pas halaman dibuka
  useEffect(() => {
    async function ambilDataAwal() {
      setLoading(true);

      const { data: dataProduk } = await supabase
        .from("produk")
        .select("*")
        .eq("is_active", true);
      if (dataProduk) setDaftarProduk(dataProduk);

      const { data: dataLog } = await supabase
        .from("transaksi")
        .select(
          "id, created_at, total_harga, metode_pembayaran, uang_diterima, uang_kembalian",
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (dataLog && dataLog.length > 0) {
        setRiwayatTransaksi(dataLog);
        setTransaksiTerakhir(dataLog[0]);
      }

      setLoading(false);
    }
    ambilDataAwal();
  }, [supabase]);

  // 2. 🔥 FIX BUG: Fungsi Tambah Barang ke Keranjang Secara Akurat
  const tambahKeKeranjang = (produk) => {
    const itemAda = keranjang.find((item) => item.produk_id === produk.id);

    // Validasi stok awal: Abaikan proteksi stok jika barang tersebut berstatus titipan harian/unlimited
    if (!produk.is_unlimited && produk.stok < 1) {
      alert(`❌ Stok produk "${produk.nama_produk}" sudah habis!`);
      return;
    }

    if (itemAda) {
      // Validasi penambahan stok bertahap
      if (!produk.is_unlimited && itemAda.jumlah >= produk.stok) {
        alert(
          "⚠️ Jumlah di keranjang sudah mencapai batas maksimal stok gudang!",
        );
        return;
      }
      setKeranjang(
        keranjang.map((item) =>
          item.produk_id === produk.id // 👈 FIX UTAMA: Properti disamakan menjadi produk_id
            ? { ...item, jumlah: (parseInt(item.jumlah) || 0) + 1 }
            : item,
        ),
      );
    } else {
      // Masukkan item baru dengan struktur properti utuh
      setKeranjang([
        ...keranjang,
        {
          id: produk.id, // ID untuk pencocokan component iterator
          produk_id: produk.id,
          nama_produk: produk.nama_produk,
          harga_jual: Number(produk.harga_jual),
          jumlah: 1,
          is_unlimited: produk.is_unlimited, // Diperlukan untuk bypass pengurangan stok di db
        },
      ]);
    }
  };

  // 3. Handler Logika Pengurutan (Sorting)
  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);
  };

  // 4. Proses Filter Pencarian + Sorting Data Sekaligus
  const produkDifilterDanDiurutkan = daftarProduk
    .filter(
      (p) =>
        p.nama_produk.toLowerCase().includes(cari.toLowerCase()) ||
        (p.barcode && p.barcode.includes(cari)),
    )
    .sort((a, b) => {
      if (!sortField) return 0;

      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "harga_jual" || sortField === "stok") {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }

      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  // 5. Hitung total belanjaan
  const totalBelanja = keranjang.reduce(
    (total, item) => total + item.harga_jual * (parseInt(item.jumlah) || 0),
    0,
  );

  const hapusDariKeranjang = (produkId) => {
    setKeranjang(keranjang.filter((item) => item.produk_id !== produkId));
  };

  const ubahJumlahInput = (produkId, jumlahBaru, aksi = "input") => {
    const itemKeranjang = keranjang.find((i) => i.produk_id === produkId);
    if (!itemKeranjang) return;

    let qty = itemKeranjang.jumlah;

    if (aksi === "tambah") {
      qty = parseInt(qty || 0) + 1;
    } else if (aksi === "kurang") {
      qty = parseInt(qty || 0) - 1;
      if (qty < 1) return;
    } else {
      qty = jumlahBaru === "" ? "" : parseInt(jumlahBaru);
    }

    if (qty !== "") {
      const produkAsli = daftarProduk.find((p) => p.id === produkId);
      // Validasi limit hanya dilakukan jika produk BUKAN unlimited
      if (produkAsli && !produkAsli.is_unlimited && qty > produkAsli.stok) {
        alert(`Stok tidak mencukupi! Maksimal stok adalah ${produkAsli.stok}`);
        return;
      }
    }

    setKeranjang(
      keranjang.map((i) =>
        i.produk_id === produkId ? { ...i, jumlah: qty } : i,
      ),
    );
  };

  const tutupModalPembayaran = () => {
    setIsModalTerbuka(false);
    setMetodeBayar(null);
    setInputUangTunai("");
    setKonfirmasiQRIS(false);
  };

  // 6. Logika Kirim Data Transaksi ke Database dengan Pengurangan Stok Terkondisi
  const eksekusiSimpanTransaksi = async () => {
    setLoading(true);

    let uangDiterima = totalBelanja;
    let uangKembalian = 0;

    if (metodeBayar === "TUNAI") {
      uangDiterima = parseInt(inputUangTunai) || 0;
      uangKembalian = uangDiterima - totalBelanja;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert Nota Utama Transaksi
      const { data: dataTransaksi, error: errorTransaksi } = await supabase
        .from("transaksi")
        .insert([
          {
            kasir_id: user?.id,
            total_harga: totalBelanja,
            metode_pembayaran:
              metodeBayar === "TUNAI" ? "Tunai" : "QRIS/Transfer",
            uang_diterima: uangDiterima,
            uang_kembalian: uangKembalian,
          },
        ])
        .select()
        .single();

      if (errorTransaksi) throw errorTransaksi;

      // Susun data detail rincian transaksi
      const dataDetail = keranjang.map((item) => ({
        transaksi_id: dataTransaksi.id,
        produk_id: item.produk_id,
        harga_satuan: Number(item.harga_jual),
        jumlah: parseInt(item.jumlah || 0),
        subtotal: Number(item.harga_jual * (item.jumlah || 0)),
      }));

      const { error: errorDetail } = await supabase
        .from("detail_transaksi")
        .insert(dataDetail);
      if (errorDetail) throw errorDetail;

      // 🛠️ BYPASS STOK TITIPAN: Kurangi stok hanya untuk barang yang tidak unlimited
      for (const item of keranjang) {
        if (item.is_unlimited) continue; // Skip pengurangan stok di DB Supabase jika barang titipan

        const produkGudang = daftarProduk.find((p) => p.id === item.produk_id);
        if (produkGudang) {
          await supabase
            .from("produk")
            .update({ stok: produkGudang.stok - item.jumlah })
            .eq("id", item.produk_id);
        }
      }

      setTransaksiTerakhir(dataTransaksi);
      setKeranjang([]);
      setBukaKeranjangMobile(false);
      tutupModalPembayaran();

      // Sinkronisasi ulang data di layar
      const { data: produkTerbaru } = await supabase
        .from("produk")
        .select("*")
        .eq("is_active", true);
      if (produkTerbaru) setDaftarProduk(produkTerbaru);

      const { data: logTerbaru } = await supabase
        .from("transaksi")
        .select(
          "id, created_at, total_harga, metode_pembayaran, uang_diterima, uang_kembalian",
        )
        .order("created_at", { ascending: false })
        .limit(5);
      if (logTerbaru) setRiwayatTransaksi(logTerbaru);
    } catch (error) {
      console.error("Gagal memproses transaksi:", error);
      alert(`❌ Terjadi kesalahan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const nominalUangTunaiInt = parseInt(inputUangTunai) || 0;
  const isTombolKonfirmasiDisabled =
    loading ||
    (metodeBayar === "TUNAI" && nominalUangTunaiInt < totalBelanja) ||
    (metodeBayar === "QRIS" && !konfirmasiQRIS);

  const bukaDetailRiwayat = async (transaksi) => {
    setModalDetailTransaksi(transaksi);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from("detail_transaksi")
        .select(
          `id, jumlah, harga_satuan, subtotal, produk:produk_id ( nama_produk )`,
        )
        .eq("transaksi_id", transaksi.id);

      if (!error && data) setItemDetailTransaksi(data);
    } catch (err) {
      console.error("Gagal mengambil detail item:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] w-full bg-slate-100 text-slate-800 font-sans overflow-hidden relative">
      {/* ================= SISI KIRI: PANEL DAFTAR PRODUK (UTAMA) ================= */}
      <div className="w-full lg:w-2/3 p-4 md:p-6 flex flex-col h-full overflow-hidden">
        {/* Input Cari Bar */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari menu produk atau scan barcode kasir..."
              className="w-full p-3 pl-10 rounded-xl border border-slate-300 shadow-2xs focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white text-xs md:text-sm font-semibold"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
        </div>

        {/* Container Tabel Scroll */}
        <div className="flex-1 bg-white rounded-2xl shadow-3xs border border-slate-200 overflow-y-auto">
          {loading && daftarProduk.length === 0 ? (
            <p className="p-12 text-center text-xs font-bold text-slate-400">
              Menghubungkan ke database menu kasir...
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 shadow-2xs z-10">
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th
                    className="p-3.5 pl-4 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("nama_produk")}
                  >
                    Nama Item{" "}
                    {sortField === "nama_produk"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-3.5 hidden sm:table-cell">Barcode</th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("harga_jual")}
                  >
                    Harga{" "}
                    {sortField === "harga_jual"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-3.5 text-center cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("stok")}
                  >
                    Stok{" "}
                    {sortField === "stok"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-3.5 text-center pr-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {produkDifilterDanDiurutkan.map((produk) => (
                  <tr
                    key={produk.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3.5 pl-4 font-black text-slate-900 text-xs md:text-sm">
                      <div className="flex flex-col">
                        <span>{produk.nama_produk}</span>
                        {produk.is_unlimited && (
                          <span className="text-[9px] text-amber-600 font-extrabold tracking-wide uppercase mt-0.5">
                            ⏳ Titipan Harian
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono hidden sm:table-cell text-[11px]">
                      {produk.barcode || "-"}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      Rp {Number(produk.harga_jual).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${produk.is_unlimited ? "bg-amber-50 text-amber-700" : produk.stok <= 5 ? "bg-rose-50 text-rose-700 font-black animate-pulse" : "bg-slate-100 text-slate-600"}`}
                      >
                        {produk.is_unlimited ? "∞" : `${produk.stok} pcs`}
                      </span>
                    </td>
                    <td className="p-3.5 text-center pr-4">
                      <button
                        onClick={() => tambahKeKeranjang(produk)}
                        disabled={!produk.is_unlimited && produk.stok < 1}
                        className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white px-2.5 py-1.5 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer"
                      >
                        Tambah
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================= SISI KANAN: PANEL KERANJANG & LOG HISTORY RESPONSIVE ================= */}
      <div
        className={`fixed lg:static inset-y-0 right-0 z-40 w-5/6 sm:w-1/2 lg:w-1/3 bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl lg:shadow-xl overflow-y-auto lg:overflow-hidden transition-transform duration-300 transform ${bukaKeranjangMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}
      >
        {/* PANEL KERANJANG (Mengunci 50% di PC, Otomatis memanjang di HP) */}
        <div className="lg:h-1/2 p-4 md:p-5 flex flex-col flex-shrink-0 lg:overflow-hidden border-b border-slate-200 bg-white">
          <div className="flex-shrink-0 mb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-black text-slate-950 uppercase tracking-wider">
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              <span>Keranjang Aktif Toko</span>
            </div>
            <button
              onClick={() => setBukaKeranjangMobile(false)}
              className="lg:hidden p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 font-bold text-xs"
            >
              ✕ Tutup
            </button>
          </div>

          {/* List Item Belanja */}
          <div className="lg:flex-1 lg:overflow-y-auto space-y-2 pr-0.5">
            {keranjang.length === 0 ? (
              <div className="text-center text-slate-400 text-[11px] font-bold py-6 lg:mt-12">
                🛒 Keranjang kosong.
              </div>
            ) : (
              keranjang.map((item) => (
                <div
                  key={item.produk_id}
                  className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/60 shadow-3xs"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {item.nama_produk}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      Rp {item.harga_jual.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden h-6">
                      <button
                        type="button"
                        onClick={() =>
                          ubahJumlahInput(item.produk_id, null, "kurang")
                        }
                        className="px-1.5 text-slate-500 font-black text-xs hover:bg-slate-50"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="w-7 text-center text-xs border-none font-bold text-slate-800 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={item.jumlah}
                        onChange={(e) =>
                          ubahJumlahInput(
                            item.produk_id,
                            e.target.value,
                            "input",
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          ubahJumlahInput(item.produk_id, null, "tambah")
                        }
                        className="px-1.5 text-slate-500 font-black text-xs hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-bold text-xs text-slate-950 w-16 text-right">
                      Rp{" "}
                      {(
                        item.harga_jual * (parseInt(item.jumlah) || 0)
                      ).toLocaleString("id-ID")}
                    </p>
                    <button
                      onClick={() => hapusDariKeranjang(item.produk_id)}
                      className="text-slate-300 hover:text-rose-600 font-bold transition-colors text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex-shrink-0 pt-3 space-y-2 bg-white border-t border-slate-100 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Total Tagihan
              </span>
              <span className="text-base font-black text-slate-950 font-mono">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </span>
            </div>
            <button
              onClick={() => setIsModalTerbuka(true)}
              disabled={
                keranjang.length === 0 ||
                keranjang.some((item) => item.jumlah === "")
              }
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl font-bold text-xs shadow-xs disabled:bg-slate-100 disabled:text-slate-400 transition-all uppercase tracking-wider cursor-pointer text-center"
            >
              Proses Pembayaran
            </button>
          </div>
        </div>

        {/* PANEL SEKTOR BAWAH: NOTIFIKASI SUKSES & LOG JURNAL HARI INI */}
        <div className="lg:h-1/2 p-4 md:p-5 flex flex-col bg-slate-50/80 lg:overflow-hidden min-h-[250px]">
          <div className="mb-3 flex-shrink-0">
            {transaksiTerakhir ? (
              <div className="bg-emerald-600 text-white rounded-xl p-2.5 shadow-sm flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black tracking-wide uppercase bg-white/20 px-1.5 py-0.5 rounded">
                    ✓ NOTA SELESAI
                  </span>
                  <span className="text-[9px] font-mono opacity-80">
                    #{transaksiTerakhir.id}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold font-mono">
                  <span>
                    Total: Rp{" "}
                    {Number(transaksiTerakhir.total_harga).toLocaleString(
                      "id-ID",
                    )}
                  </span>
                  {transaksiTerakhir.metode_pembayaran === "Tunai" ? (
                    <span>
                      Kembali: Rp{" "}
                      {Number(transaksiTerakhir.uang_kembalian).toLocaleString(
                        "id-ID",
                      )}
                    </span>
                  ) : (
                    <span className="text-[9px] text-emerald-200">
                      📱 QRIS PAS
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl p-2.5 text-center text-[10px] text-slate-400 font-bold bg-white">
                Sesi transaksi kasir baru dimulai.
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col lg:overflow-hidden">
            <div className="flex items-center space-x-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              <History className="h-3.5 w-3.5" />
              <span>Log Jurnal Hari Ini (5 Terakhir)</span>
            </div>
            <div className="space-y-1.5 pr-0.5 lg:overflow-y-auto lg:flex-1">
              {riwayatTransaksi.length === 0 ? (
                <p className="text-center text-[10px] text-slate-400 py-4">
                  Belum ada rekam transaksi.
                </p>
              ) : (
                riwayatTransaksi.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => bukaDetailRiwayat(log)}
                    className="bg-white border border-slate-200 hover:border-slate-400 p-2.5 rounded-xl flex justify-between items-center text-[11px] font-bold text-slate-800 shadow-2xs cursor-pointer transition-all select-none"
                  >
                    <div>
                      <p className="text-slate-950 font-black">
                        Rp {Number(log.total_harga).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono font-normal mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WITA
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${log.metode_pembayaran === "Tunai" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                    >
                      {log.metode_pembayaran}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= FLOATING ACTION BAR FOR MOBILE ================= */}
      {keranjang.length > 0 && (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-30 bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between border border-slate-800 animate-in slide-in-from-bottom duration-200">
          <div
            onClick={() => setBukaKeranjangMobile(true)}
            className="flex items-center space-x-3 cursor-pointer"
          >
            <div className="relative p-2 bg-white/10 rounded-xl">
              <ShoppingCart className="h-5 w-5 text-emerald-400" />
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                {keranjang.length}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">
                Total Belanjaan ({keranjang.length} Item)
              </p>
              <p className="text-sm font-black font-mono text-emerald-400">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalTerbuka(true)}
            disabled={keranjang.some((item) => item.jumlah === "")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider px-4 py-2 rounded-xl shadow-md cursor-pointer"
          >
            Bayar ➔
          </button>
        </div>
      )}

      {/* Tombol Akses Riwayat Instan Khusus Mobile Saat Keranjang Kosong */}
      {keranjang.length === 0 && (
        <button
          onClick={() => setBukaKeranjangMobile(true)}
          className="lg:hidden fixed bottom-4 right-4 z-30 bg-slate-900 text-white p-3.5 rounded-full shadow-2xl border border-slate-800 flex items-center justify-center cursor-pointer"
          title="Buka Riwayat Kasir"
        >
          <History className="h-5 w-5 text-amber-400" />
        </button>
      )}

      {bukaKeranjangMobile && (
        <div
          onClick={() => setBukaKeranjangMobile(false)}
          className="lg:hidden fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs"
        />
      )}

      {/* ======================= MODAL CHECKOUT PEMBAYARAN ======================= */}
      {isModalTerbuka && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Sesi Checkout Pembayaran
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Pilih opsi pembayaran di bawah ini
                </p>
              </div>
              <button
                onClick={tutupModalPembayaran}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Total Tagihan
                </span>
                <span className="text-xl font-black font-mono">
                  Rp {totalBelanja.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Pilih Metode:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMetodeBayar("TUNAI");
                      setInputUangTunai("");
                    }}
                    className={`p-3 rounded-xl border-2 font-black text-xs transition-all ${metodeBayar === "TUNAI" ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    💵 UANG TUNAI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMetodeBayar("QRIS");
                      setInputUangTunai("");
                    }}
                    className={`p-3 rounded-xl border-2 font-black text-xs transition-all ${metodeBayar === "QRIS" ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    📱 QRIS / TRANSFER
                  </button>
                </div>
              </div>

              {metodeBayar === "TUNAI" && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                      Uang Diterima (Ketik Angka):
                    </label>
                    <input
                      type="number"
                      placeholder="Contoh: 50000"
                      autoFocus
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:border-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={inputUangTunai}
                      onChange={(e) => setInputUangTunai(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs border-t pt-2 border-slate-200">
                    <span className="font-semibold text-slate-400">
                      Terbaca:
                    </span>
                    <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border shadow-inner">
                      Rp {nominalUangTunaiInt.toLocaleString("id-ID")}
                    </span>
                  </div>
                  {nominalUangTunaiInt >= totalBelanja && (
                    <div className="flex justify-between items-center text-xs text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg">
                      <span>Uang Kembalian:</span>
                      <span className="font-mono text-sm">
                        Rp{" "}
                        {(nominalUangTunaiInt - totalBelanja).toLocaleString(
                          "id-ID",
                        )}
                      </span>
                    </div>
                  )}
                  {inputUangTunai && nominalUangTunaiInt < totalBelanja && (
                    <p className="text-[10px] text-rose-600 font-bold">
                      ⚠️ Nominal uang masih kurang dari total tagihan!
                    </p>
                  )}
                </div>
              )}

              {metodeBayar === "QRIS" && (
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    Pelanggan memindai QRIS resmi toko. Periksa layar handphone
                    mereka.
                  </p>
                  <label className="flex items-start space-x-2.5 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                      checked={konfirmasiQRIS}
                      onChange={(e) => setKonfirmasiQRIS(e.target.checked)}
                    />
                    <span className="text-[11px] text-slate-700 font-bold leading-tight">
                      Saya mengonfirmasi bahwa status transfer di HP pelanggan
                      sud 'SUKSES'.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={tutupModalPembayaran}
                className="w-1/3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={eksekusiSimpanTransaksi}
                disabled={isTombolKonfirmasiDisabled}
                className="w-2/3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md disabled:bg-slate-200 disabled:text-slate-400 transition-all uppercase tracking-wider"
              >
                {loading ? "Memproses..." : "Konfirmasi & Selesai"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL POPUP RINCIAN ITEM NOTA ======================= */}
      {modalDetailTransaksi && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Isi Nota Belanja
                </h3>
                <p className="text-[9px] font-mono text-slate-400">
                  ID Nota: #{modalDetailTransaksi.id}
                </p>
              </div>
              <button
                onClick={() => setModalDetailTransaksi(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[50vh] space-y-2">
              {loadingDetail ? (
                <p className="text-center text-xs font-bold text-slate-400 py-4">
                  Mengambil daftar produk...
                </p>
              ) : itemDetailTransaksi.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">
                  Gagal memuat item atau data kosong.
                </p>
              ) : (
                itemDetailTransaksi.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-xs border-b border-slate-50 pb-2"
                  >
                    <div className="max-w-[180px]">
                      <p className="font-bold text-slate-900 truncate">
                        {item.produk?.nama_produk || "Produk Terhapus"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {item.jumlah} pcs x Rp{" "}
                        {Number(item.harga_satuan).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <span className="font-bold text-slate-950">
                      Rp {Number(item.subtotal).toLocaleString("id-ID")}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Metode Pembayaran:</span>
                <span className="uppercase text-slate-900 font-black">
                  {modalDetailTransaksi.metode_pembayaran}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-dashed border-slate-200">
                <span>Total Lunas:</span>
                <span className="font-mono text-emerald-700">
                  Rp{" "}
                  {Number(modalDetailTransaksi.total_harga).toLocaleString(
                    "id-ID",
                  )}
                </span>
              </div>
              <button
                onClick={() => setModalDetailTransaksi(null)}
                className="w-full mt-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase transition-all"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
